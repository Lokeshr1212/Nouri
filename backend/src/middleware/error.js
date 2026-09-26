const ApiError = require("../utils/ApiError");
const env = require("../config/env");

function notFound(req, res, next) {
  next(new ApiError(404, "NOT_FOUND", `Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || "Something went wrong";
  let code = err.code || "INTERNAL_ERROR";
  let details = err.details;

  if (err.name === "MulterError") {
    status = 400;
    code = "UPLOAD_ERROR";
    if (err.code === "LIMIT_FILE_SIZE") {
      message = `Image too large. Maximum size is ${env.maxFileSize}.`;
      code = "FILE_TOO_LARGE";
    }
  } else if (err.name === "UNSUPPORTED_FILE") {
    status = 415;
    code = "INVALID_IMAGE";
    message = err.message;
  } else if (err.name === "PrismaClientKnownRequestError") {
    if (err.code === "P2002") {
      status = 409;
      code = "CONFLICT";
      message = "That value is already in use.";
    } else if (err.code === "P2025") {
      status = 404;
      code = "NOT_FOUND";
      message = "The requested resource was not found.";
    } else {
      status = 400;
    }
  } else if (err.type === "entity.too.large") {
    status = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "Request body is too large.";
  }

  if (status >= 500) {
    console.error("[error]", err);
  }

  if (res.headersSent) return next(err);
  return res.status(status).json({
    success: false,
    error: { message, code, ...(details ? { details } : {}) },
  });
}

module.exports = { notFound, errorHandler };