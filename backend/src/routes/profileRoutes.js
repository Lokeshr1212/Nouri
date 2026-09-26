const { Router } = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/profileController");
const { validate } = require("../middleware/validate");
const { authRequired } = require("../middleware/auth");

const router = Router();

router.use(authRequired);

router.get("/", controller.getProfile);

router.put(
  "/",
  validate([
    body("name").optional().trim().isLength({ min: 2, max: 80 }),
    body("age").optional().isInt({ min: 1, max: 130 }),
    body("heightCm").optional().isFloat({ min: 50, max: 260 }),
    body("currentWeightKg").optional().isFloat({ min: 20, max: 500 }),
    body("targetWeightKg").optional().isFloat({ min: 20, max: 500 }),
    body("calorieGoal").optional().isInt({ min: 800, max: 8000 }),
    body("proteinGoal").optional().isInt({ min: 10, max: 500 }),
    body("carbGoal").optional().isInt({ min: 10, max: 900 }),
    body("fatGoal").optional().isInt({ min: 5, max: 400 }),
    body("hydrationGoalGlasses").optional().isInt({ min: 1, max: 30 }),
  ]),
  controller.updateProfile
);

module.exports = router;