require("dotenv").config();

function required(name, devFallback) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    if (process.env.NODE_ENV === "production" || devFallback === undefined) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return devFallback;
  }
  return value;
}

const env = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  refreshTokenTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || "7", 10),
  saltRounds: parseInt(process.env.SALT_ROUNDS || "12", 10),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5000",
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  serveFrontend: (process.env.SERVE_FRONTEND || "true") === "true",
  frontendDir: process.env.FRONTEND_DIR || "../frontend(nauri)",
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  maxFileSize: process.env.MAX_FILE_SIZE || "5mb",
  aiProvider: (process.env.AI_PROVIDER || "mock").toLowerCase(),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  nutritionProvider: (process.env.NUTRITION_PROVIDER || "mock").toLowerCase(),
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASSWORD || "",
    from: process.env.MAIL_FROM || "Nouri <no-reply@nouri.app>",
  },
  devReturnResetToken: (process.env.DEV_RETURN_RESET_TOKEN || "false") === "true",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  },
};

module.exports = env;