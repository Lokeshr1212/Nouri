const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/response");
const {
  issueTokenPair,
  consumeRefreshToken,
  revokeRefreshToken,
} = require("../services/tokenService");
const { randomToken, hashToken } = require("../utils/crypto");
const emailService = require("../services/emailService");

function serializePublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
    googleId: user.googleId || null,
    createdAt: user.createdAt,
  };
}

function userAgent(req) {
  return req.headers["user-agent"] || null;
}

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const normalizedEmail = String(email).toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw new ApiError(409, "EMAIL_IN_USE", "An account with this email already exists.");

  const passwordHash = await bcrypt.hash(String(password), env.saltRounds);
  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      nutritionProfile: { create: {} },
    },
    include: { nutritionProfile: true },
  });

  const tokens = await issueTokenPair(user.id, false, userAgent(req));
  ok(res, { user: serializePublicUser(user), ...tokens }, 201);
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;
  const normalizedEmail = String(email).toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");

  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");

  const tokens = await issueTokenPair(user.id, Boolean(rememberMe), userAgent(req));
  ok(res, { user: serializePublicUser(user), ...tokens });
});

exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(401, "REFRESH_REQUIRED", "A refresh token is required.");

  const record = await consumeRefreshToken(String(refreshToken));
  if (!record) throw new ApiError(401, "INVALID_REFRESH", "Your session is no longer valid. Please log in again.");

  const tokens = await issueTokenPair(record.userId, false, userAgent(req));
  ok(res, { ...tokens });
});

exports.logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) await revokeRefreshToken(String(refreshToken));
  ok(res, { message: "Logged out." });
});

exports.me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { nutritionProfile: true },
  });
  if (!user) throw new ApiError(401, "INVALID_TOKEN", "Account no longer exists.");
  ok(res, { user: serializePublicUser(user), profile: user.nutritionProfile });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });

  const generic = { message: "If an account exists for that email, a reset link has been sent." };

  if (user) {
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    const token = randomToken(32);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const { delivered } = await emailService.sendPasswordResetEmail(user.email, token);
    if (env.devReturnResetToken && env.nodeEnv !== "production") {
      return ok(res, { ...generic, delivered, devResetToken: token });
    }
    return ok(res, { ...generic, delivered });
  }

  ok(res, generic);
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(String(token)) },
  });
  if (!record) throw new ApiError(400, "INVALID_RESET_TOKEN", "This reset link is invalid.");
  if (record.usedAt) throw new ApiError(400, "INVALID_RESET_TOKEN", "This reset link has already been used.");
  if (record.expiresAt < new Date())
    throw new ApiError(400, "RESET_TOKEN_EXPIRED", "This reset link has expired.");

  const passwordHash = await bcrypt.hash(String(password), env.saltRounds);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: record.userId }, data: { revokedAt: new Date() } }),
  ]);

  ok(res, { message: "Password updated successfully. You can now log in." });
});

exports.google = asyncHandler(async (req, res) => {
  if (!env.google.clientId) {
    throw new ApiError(501, "NOT_CONFIGURED", "Google sign-in is not configured on this server yet.");
  }
  const { credential, rememberMe } = req.body;
  if (!credential) throw new ApiError(422, "GOOGLE_CREDENTIAL_REQUIRED", "Google credential missing.");

  let payload;
  try {
    const { OAuth2Client } = require("google-auth-library");
    const client = new OAuth2Client(env.google.clientId);
    const ticket = await client.verifyIdToken({
      idToken: String(credential),
      audience: env.google.clientId,
    });
    payload = ticket.getPayload();
  } catch (error) {
    throw new ApiError(401, "GOOGLE_VERIFY_FAILED", "We could not verify your Google account.");
  }

  if (!payload || !payload.email) {
    throw new ApiError(400, "GOOGLE_NO_EMAIL", "Google did not provide an email address.");
  }

  let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });
  if (!user) user = await prisma.user.findUnique({ where: { email: payload.email.toLowerCase() } });

  if (user) {
    if (!user.googleId) {
      user = await prisma.user.update({ where: { id: user.id }, data: { googleId: payload.sub } });
    }
  } else {
    const passwordHash = await bcrypt.hash(randomToken(24), env.saltRounds);
    user = await prisma.user.create({
      data: {
        email: payload.email.toLowerCase(),
        name: payload.name || payload.email.split("@")[0],
        passwordHash,
        googleId: payload.sub,
        nutritionProfile: { create: {} },
      },
    });
  }

  const tokens = await issueTokenPair(user.id, Boolean(rememberMe), userAgent(req));
  ok(res, { user: serializePublicUser(user), ...tokens });
});