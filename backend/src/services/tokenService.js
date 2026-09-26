const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { randomToken, hashToken } = require("../utils/crypto");
const prisma = require("../config/prisma");

const ACCESS_TOKEN_TYPE = "access";
const REFRESH_TOKEN_TYPE = "refresh";

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, type: ACCESS_TOKEN_TYPE, email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.jwtSecret);
  if (payload.type !== ACCESS_TOKEN_TYPE) {
    const err = new Error("Invalid token type");
    err.name = "JsonWebTokenError";
    throw err;
  }
  return payload;
}

async function issueRefreshToken(userId, rememberMe = false, userAgent = null) {
  const token = randomToken(48);
  const ttlDays = rememberMe ? Math.max(env.refreshTokenTtlDays, 30) : env.refreshTokenTtlDays;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, userAgent: userAgent || null },
  });
  return { token, expiresAt };
}

async function issueTokenPair(userId, rememberMe = false, userAgent = null) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const accessToken = signAccessToken(user);
  const { token: refreshToken, expiresAt } = await issueRefreshToken(userId, rememberMe, userAgent);
  return { accessToken, refreshToken, refreshExpiresAt: expiresAt };
}

async function consumeRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!record || record.revokedAt) return null;
  if (record.expiresAt < new Date()) return null;
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  return record;
}

async function revokeRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (record && !record.revokedAt) {
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  }
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  issueTokenPair,
  consumeRefreshToken,
  revokeRefreshToken,
};