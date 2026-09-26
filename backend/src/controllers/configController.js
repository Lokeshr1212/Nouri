const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/response");
const env = require("../config/env");

exports.getConfig = asyncHandler(async (req, res) => {
  ok(res, {
    googleClientId: env.google.clientId || null,
    aiProvider: env.aiProvider,
    aiEnabled: Boolean(env.aiProvider !== "mock" && env.geminiApiKey),
    name: "Nouri API",
    version: "1.0.0",
  });
});