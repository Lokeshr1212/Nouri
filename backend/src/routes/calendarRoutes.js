const { Router } = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/calendarController");
const { validate } = require("../middleware/validate");
const { authRequired } = require("../middleware/auth");

const router = Router();

router.use(authRequired);

router.get("/", controller.getCalendar);

router.post(
  "/meals",
  validate([
    body("name").trim().isLength({ min: 1, max: 120 }).withMessage("Enter a meal name."),
    body("mealType").optional().isIn(["breakfast", "lunch", "dinner", "snack"]),
    body("calories").optional().isFloat({ min: 0, max: 10000 }),
    body("scheduledDate").isISO8601().withMessage("scheduledDate must be YYYY-MM-DD."),
  ]),
  controller.createMeal
);

router.put(
  "/meals/:id",
  validate([
    body("name").optional().trim().isLength({ min: 1, max: 120 }),
    body("mealType").optional().isIn(["breakfast", "lunch", "dinner", "snack"]),
    body("calories").optional().isFloat({ min: 0, max: 10000 }),
    body("scheduledDate").optional().isISO8601(),
  ]),
  controller.updateMeal
);

router.delete("/meals/:id", controller.deleteMeal);

module.exports = router;