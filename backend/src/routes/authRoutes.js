const { Router } = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/authController");
const { validate } = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimit");
const { authRequired } = require("../middleware/auth");

const router = Router();

const email = body("email").isEmail().withMessage("Enter a valid email address.").normalizeEmail();
const password = body("password").isLength({ min: 8, max: 128 }).withMessage("Password must be at least 8 characters.");

router.post("/register", authLimiter, validate([
  body("name").trim().isLength({ min: 2, max: 80 }).withMessage("Please enter your name (2–80 characters)."),
  email,
  password,
]), controller.register);

router.post("/login", authLimiter, validate([
  email,
  password,
  body("rememberMe").optional().isBoolean(),
]), controller.login);

router.post("/refresh", authLimiter, validate([
  body("refreshToken").isString().notEmpty().withMessage("Refresh token required."),
]), controller.refresh);

router.post("/logout", authLimiter, validate([
  body("refreshToken").optional().isString(),
]), controller.logout);

router.get("/me", authRequired, controller.me);

router.post("/forgot-password", authLimiter, validate([
  email,
]), controller.forgotPassword);

router.post("/reset-password", authLimiter, validate([
  body("token").isString().notEmpty().withMessage("Reset token required."),
  password,
]), controller.resetPassword);

router.post("/google", authLimiter, validate([
  body("credential").isString().notEmpty().withMessage("Google credential required."),
  body("rememberMe").optional().isBoolean(),
]), controller.google);

module.exports = router;