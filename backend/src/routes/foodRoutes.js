const { Router } = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/foodController");
const { validate } = require("../middleware/validate");
const { authRequired } = require("../middleware/auth");
const { uploadImage } = require("../middleware/upload");

const router = Router();

router.use(authRequired);

router.post("/analyze", uploadImage.single("image"), controller.analyze);

router.post(
  "/log",
  validate([
    body("foodName").trim().isLength({ min: 1, max: 120 }).withMessage("Enter a food name."),
    body("mealType").optional().isIn(["breakfast", "lunch", "dinner", "snack"]),
    body("calories").optional().isFloat({ min: 0, max: 10000 }),
    body("protein").optional().isFloat({ min: 0, max: 5000 }),
    body("carbs").optional().isFloat({ min: 0, max: 5000 }),
    body("fats").optional().isFloat({ min: 0, max: 5000 }),
    body("loggedAt").optional().isISO8601(),
  ]),
  controller.log
);

module.exports = router;