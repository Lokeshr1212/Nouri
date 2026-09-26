const { Router } = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/dietPlanController");
const { validate } = require("../middleware/validate");
const { authRequired } = require("../middleware/auth");

const router = Router();

router.use(authRequired);

router.get("/", controller.getPlan);

router.post(
  "/",
  validate([
    body("dailyCalorieTarget").optional().isInt({ min: 1000, max: 6000 }),
    body("proteinTarget").optional().isInt({ min: 30, max: 400 }),
    body("plantVarietyTarget").optional().isInt({ min: 10, max: 60 }),
  ]),
  controller.createPlan
);

router.put(
  "/:id",
  validate([
    body("dailyCalorieTarget").optional().isInt({ min: 1000, max: 6000 }),
    body("proteinTarget").optional().isInt({ min: 30, max: 400 }),
    body("plantVarietyTarget").optional().isInt({ min: 10, max: 60 }),
  ]),
  controller.updatePlan
);

router.delete("/:id", controller.deletePlan);

router.post("/:id/refresh", controller.refreshPlan);

module.exports = router;