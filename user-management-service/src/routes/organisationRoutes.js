const express = require("express");
const router = express.Router();
const { requireRole } = require("../middleware/roleMiddleware");
const {
  addMember,
  listMembers,
  updateMemberRole,
  getUserById,
  getUsersByIds,
  suspendMember,
  reassignMember,
  archiveMember,
} = require("../controllers/organisationController");

// Member management
router.post("/members/:userId",               requireRole(["admin"]), addMember);
router.get("/members",                        requireRole(["admin"]), listMembers);
router.patch("/members/:userId/role",         requireRole(["admin"]), updateMemberRole);

// Offboarding lifecycle
router.post("/members/:userId/suspend",       requireRole(["admin"]), suspendMember);
router.post("/members/:userId/reassign",      requireRole(["admin", "manager"]), reassignMember);
router.post("/members/:userId/archive",       requireRole(["admin"]), archiveMember);

// Internal endpoints — called by other services directly (not through Gateway)
router.get("/users/:id",                      getUserById);
router.post("/users/by-ids",                  getUsersByIds);

// DELETE /members/:userId intentionally removed — use /suspend instead

module.exports = router;
