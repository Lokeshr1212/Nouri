const { Router } = require("express");
const controller = require("../controllers/configController");

const router = Router();

router.get("/", controller.getConfig);

module.exports = router;