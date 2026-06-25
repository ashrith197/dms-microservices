const express = require("express");
const router = express.Router();
const {
  reassignDocuments,
  checkOwnerDocuments,
} = require("../controllers/internalController");

// ─────────────────────────────────────────
// Internal routes for inter-service communication
// These routes are called by User Management Service
// during offboarding workflows
// ─────────────────────────────────────────

// Bulk reassign documents from one owner to another
router.patch("/reassign", reassignDocuments);

// Check if a user owns any documents
router.get("/owner-check/:userId", checkOwnerDocuments);

module.exports = router;
