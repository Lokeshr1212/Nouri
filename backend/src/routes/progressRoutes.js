const { Router } = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/progressController");
const { validate } = require("../middleware/validate");
const { authRequired } = require("../middleware/auth");

const router = Router();

router.use(authRequired);

router.get("/", controller.getProgress);

router.post(
  "/weight",
  validate([
    body("weight").isFloat({ min: 20, max: 500 }).withMessage("Enter a valid weight in kg."),
    body("recordedAt").optional().isISO8601(),
  ]),
  controller.addWeight
);

router.get("/weight", controller.getWeightHistory);

router.get("/habits", controller.getHabits);

router.post(
  "/habit",
  validate([
    body("habitName").optional().trim().isLength({ min: 1, max: 80 }),
    body("date").optional().isISO8601(),
  ]),
  controller.addHabit
);

module.exports = router;