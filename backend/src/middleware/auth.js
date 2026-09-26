const { verifyAccessToken } = require("../services/tokenService");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

function extractBearer(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

async function authRequired(req, res, next) {
  try {
    const token = extractBearer(req);
    if (!token) throw new ApiError(401, "AUTH_REQUIRED", "Authentication required.");
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, plan: true, googleId: true },
    });
    if (!user) throw new ApiError(401, "INVALID_TOKEN", "Account no longer exists.");
    req.user = user;
    req.auth = { sub: user.id };
    return next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    if (error.name === "TokenExpiredError") {
      return next(new ApiError(401, "TOKEN_EXPIRED", "Your session has expired. Please log in again."));
    }
    return next(new ApiError(401, "INVALID_TOKEN", "Invalid or expired session."));
  }
}

module.exports = { authRequired };