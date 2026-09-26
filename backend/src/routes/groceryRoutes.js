const { Router } = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/groceryController");
const { validate } = require("../middleware/validate");
const { authRequired } = require("../middleware/auth");

const router = Router();

router.use(authRequired);

router.get("/", controller.getGrocery);

router.post(
  "/",
  validate([body("itemName").trim().isLength({ min: 1, max: 120 }).withMessage("Enter an item name.")]),
  controller.addGrocery
);

router.put(
  "/:id",
  validate([
    body("itemName").optional().trim().isLength({ min: 1, max: 120 }),
    body("completed").optional().isBoolean(),
  ]),
  controller.updateGrocery
);

router.delete("/:id", controller.deleteGrocery);

module.exports = router;