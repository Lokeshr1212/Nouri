const { Router } = require("express");
const controller = require("../controllers/dashboardController");
const { authRequired } = require("../middleware/auth");

const router = Router();

router.get("/", authRequired, controller.getDashboard);

module.exports = router;