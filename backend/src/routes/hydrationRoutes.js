const { Router } = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/hydrationController");
const { validate } = require("../middleware/validate");
const { authRequired } = require("../middleware/auth");

const router = Router();

router.use(authRequired);

router.get("/", controller.getHydration);
router.get("/goal", controller.getGoal);

router.post(
  "/",
  validate([
    body("date").optional().isISO8601(),
    body("amountGlasses").optional().isFloat({ min: 0, max: 30 }),
  ]),
  controller.addHydration
);

router.put(
  "/:id",
  validate([body("amountGlasses").isFloat({ min: 0, max: 30 })]),
  controller.updateHydration
);

module.exports = router;