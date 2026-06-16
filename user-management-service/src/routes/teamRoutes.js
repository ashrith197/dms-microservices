const express = require("express");
const router = express.Router();
const { requireRole } = require("../middleware/roleMiddleware");
const {
  createTeam, listTeams, getTeamById,
  updateTeam, deleteTeam, addTeamMembers, removeTeamMember,
} = require("../controllers/teamController");

router.post("/",                      requireRole(["manager", "admin"]), createTeam);
router.get("/",                       requireRole(["manager", "admin", "employee"]), listTeams);
router.get("/:id",                    requireRole(["manager", "admin", "employee"]), getTeamById);
router.patch("/:id",                  requireRole(["manager", "admin"]), updateTeam);
router.delete("/:id",                 requireRole(["manager", "admin"]), deleteTeam);
router.post("/:id/members",           requireRole(["manager", "admin"]), addTeamMembers);
router.delete("/:id/members/:userId", requireRole(["manager", "admin"]), removeTeamMember);

module.exports = router;
