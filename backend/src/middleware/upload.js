const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const env = require("../config/env");

const uploadPath = path.resolve(__dirname, "..", env.uploadDir);
fs.mkdirSync(uploadPath, { recursive: true });

const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED.has(ext)) {
    const error = new Error("Only image files are allowed (jpg, png, webp, gif, avif).");
    error.name = "UNSUPPORTED_FILE";
    return cb(error);
  }
  return cb(null, true);
};

const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.maxFileSize === "5mb" ? 5 * 1024 * 1024 : parseInt(env.maxFileSize, 10) || 5 * 1024 * 1024,
    files: 1,
  },
});

module.exports = { uploadImage };