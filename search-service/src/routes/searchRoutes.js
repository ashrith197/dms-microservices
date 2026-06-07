const express = require("express");
const router = express.Router();
const { search, getFilters, getStats } = require("../controllers/searchController");

// Specific routes before parameterized routes — prevents shadowing
router.get("/filters", getFilters);
router.get("/stats", getStats);
router.get("/", search);

module.exports = router;
