const express = require("express");
const router  = express.Router();
const { getLogs, getLogById } = require("../controllers/logController");

router.get("/",    getLogs);
router.get("/:id", getLogById);

module.exports = router;
