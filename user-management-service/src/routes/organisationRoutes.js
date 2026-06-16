const express = require("express");
const router = express.Router();
const { requireRole } = require("../middleware/roleMiddleware");
const {
  addMember, removeMember, listMembers,
  updateMemberRole, getUserById, getUsersByIds,
} = require("../controllers/organisationController");

router.post("/members/:userId",              requireRole(["admin"]), addMember);
router.delete("/members/:userId",            requireRole(["admin"]), removeMember);
router.get("/members",                       requireRole(["admin"]), listMembers);
router.patch("/members/:userId/role",        requireRole(["admin"]), updateMemberRole);

// Internal endpoints — called by other services directly (not through Gateway)
router.get("/users/:id",                     getUserById);
router.post("/users/by-ids",                 getUsersByIds);

module.exports = router;
