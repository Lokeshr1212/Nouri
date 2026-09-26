const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const env = require("./config/env");
const { notFound, errorHandler } = require("./middleware/error");
const { apiLimiter } = require("./middleware/rateLimit");
const ApiError = require("./utils/ApiError");

const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const foodRoutes = require("./routes/foodRoutes");
const dietPlanRoutes = require("./routes/dietPlanRoutes");
const calendarRoutes = require("./routes/calendarRoutes");
const progressRoutes = require("./routes/progressRoutes");
const hydrationRoutes = require("./routes/hydrationRoutes");
const groceryRoutes = require("./routes/groceryRoutes");
const configRoutes = require("./routes/configRoutes");

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "img-src": ["'self'", "data:", "blob:"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "script-src": ["'self'", "https://accounts.google.com"],
        "frame-src": ["https://accounts.google.com"],
        "connect-src": ["'self'", "https://generativelanguage.googleapis.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

const allowedOrigins = new Set([env.frontendUrl, ...env.corsOrigins]);
if (env.nodeEnv !== "production") {
  allowedOrigins.add("null");
}
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new ApiError(403, "CORS_DENIED", `Origin ${origin} is not allowed.`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", apiLimiter);

app.get("/api/health", (req, res) => {
  res.json({ success: true, data: { status: "ok", name: "Nouri API", uptime: process.uptime() } });
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/food", foodRoutes);
app.use("/api/diet-plan", dietPlanRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/hydration", hydrationRoutes);
app.use("/api/grocery", groceryRoutes);
app.use("/api/config", configRoutes);

const uploadsPath = path.resolve(__dirname, "..", env.uploadDir);
fs.mkdirSync(uploadsPath, { recursive: true });
app.use("/uploads", express.static(uploadsPath, { dotfiles: "deny", maxAge: "1d" }));

if (env.serveFrontend) {
  const frontendDir = path.resolve(__dirname, "..", env.frontendDir);
  app.use(express.static(frontendDir));
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    data: {
      message: "Nouri API is running.",
      docs: "/api/health",
      frontend: env.serveFrontend ? "Served at /" : `Open ${env.frontendUrl}`,
    },
  });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;