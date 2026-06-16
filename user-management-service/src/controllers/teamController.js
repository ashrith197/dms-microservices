const Team = require("../models/Team");
const User = require("../models/User");
const mongoose = require("mongoose");

// Helper: sync memberEmails from User records whenever memberIds change
const syncMemberEmails = async (memberIds) => {
  if (!memberIds || memberIds.length === 0) return [];
  const users = await User.find({ _id: { $in: memberIds } }).select("email");
  return users.map((u) => u.email);
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ─────────────────────────────────────────
// POST /teams
// Manager creates a team
// ─────────────────────────────────────────
const createTeam = async (req, res) => {
  try {
    const manager = req.gatewayUser;
    const { name, description, memberIds } = req.body;
    const trimmedName = name.trim();

    if (!name) {
      return res.status(400).json({ success: false, message: "Team name is required" });
    }

    if (!manager.organisationId) {
      return res.status(400).json({
        success: false,
        message: "Manager must belong to an organisation to create a team",
      });
    }

    // Validate all memberIds belong to same organisation
    let validatedMemberIds = [];
    let memberEmails = [];

    if (memberIds && memberIds.length > 0) {
      const members = await User.find({
        _id: { $in: memberIds },
        organisationId: manager.organisationId,
      }).select("email _id");

      if (members.length !== memberIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more members do not belong to your organisation",
        });
      }

      validatedMemberIds = members.map((m) => m._id);
      memberEmails = members.map((m) => m.email);
    }

    const existingTeam = await Team.findOne({
      organisationId: manager.organisationId,
      name: { $regex: new RegExp(`^${escapeRegExp(trimmedName)}$`, "i") },
    });

    let team;

    if (existingTeam) {
      const existingMemberIds = new Set(
        existingTeam.memberIds.map((id) => id.toString())
      );
      const existingMemberEmails = new Set(existingTeam.memberEmails);

      validatedMemberIds.forEach((memberId, index) => {
        const memberIdString = memberId.toString();
        if (!existingMemberIds.has(memberIdString)) {
          existingTeam.memberIds.push(memberId);
          existingMemberIds.add(memberIdString);
        }

        const email = memberEmails[index];
        if (email && !existingMemberEmails.has(email)) {
          existingTeam.memberEmails.push(email);
          existingMemberEmails.add(email);
        }
      });

      if (description !== undefined) {
        existingTeam.description = description;
      }

      team = await existingTeam.save();
    } else {
      team = await Team.create({
        name: trimmedName,
        description: description || "",
        managerId: manager.userId,
        memberIds: validatedMemberIds,
        memberEmails,
        organisationId: manager.organisationId,
      });
    }

    res.status(201).json({
      success: true,
      message: existingTeam
        ? "Team already existed, members updated successfully"
        : "Team created successfully",
      team,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// GET /teams
// List all teams in user's organisation
// ─────────────────────────────────────────
const listTeams = async (req, res) => {
  try {
    const user = req.gatewayUser;

    if (!user.organisationId) {
      return res.status(400).json({
        success: false,
        message: "User must belong to an organisation",
      });
    }

    const teams = await Team.find({
      organisationId: user.organisationId,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: teams.length,
      teams,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// GET /teams/:id
// Get team details
// ─────────────────────────────────────────
const getTeamById = async (req, res) => {
  try {
    const user = req.gatewayUser;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid team ID" });
    }

    const team = await Team.findOne({
      _id: req.params.id,
      organisationId: user.organisationId,
    });

    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    res.status(200).json({ success: true, team });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// PATCH /teams/:id
// Manager updates team name/description (own teams only)
// ─────────────────────────────────────────
const updateTeam = async (req, res) => {
  try {
    const manager = req.gatewayUser;
    const { name, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid team ID" });
    }

    const team = await Team.findOne({
      _id: req.params.id,
      organisationId: manager.organisationId,
    });

    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    // Manager can only update their own teams; Admin can update any
    if (manager.userRole === "manager" &&
        team.managerId.toString() !== manager.userId) {
      return res.status(403).json({
        success: false,
        message: "Managers can only update their own teams",
      });
    }

    if (name) team.name = name;
    if (description !== undefined) team.description = description;

    await team.save();

    res.status(200).json({
      success: true,
      message: "Team updated successfully",
      team,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// DELETE /teams/:id
// Manager deletes their own team
// ─────────────────────────────────────────
const deleteTeam = async (req, res) => {
  try {
    const manager = req.gatewayUser;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid team ID" });
    }

    const team = await Team.findOne({
      _id: req.params.id,
      organisationId: manager.organisationId,
    });

    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    if (manager.userRole === "manager" &&
        team.managerId.toString() !== manager.userId) {
      return res.status(403).json({
        success: false,
        message: "Managers can only delete their own teams",
      });
    }

    await Team.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Team deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// POST /teams/:id/members
// Add members to a team
// ─────────────────────────────────────────
const addTeamMembers = async (req, res) => {
  try {
    const manager = req.gatewayUser;
    const { memberIds } = req.body;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "memberIds must be a non-empty array",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid team ID" });
    }

    const team = await Team.findOne({
      _id: req.params.id,
      organisationId: manager.organisationId,
    });

    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    if (manager.userRole === "manager" &&
        team.managerId.toString() !== manager.userId) {
      return res.status(403).json({
        success: false,
        message: "Managers can only modify their own teams",
      });
    }

    // Validate all new members belong to same organisation
    const newMembers = await User.find({
      _id: { $in: memberIds },
      organisationId: manager.organisationId,
    }).select("_id email");

    if (newMembers.length !== memberIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more users do not belong to your organisation",
      });
    }

    // Add only members not already in team
    const existingIds = team.memberIds.map((id) => id.toString());
    const toAdd = newMembers.filter((m) => !existingIds.includes(m._id.toString()));

    team.memberIds.push(...toAdd.map((m) => m._id));
    team.memberEmails.push(...toAdd.map((m) => m.email));

    await team.save();

    res.status(200).json({
      success: true,
      message: `${toAdd.length} member(s) added to team`,
      team,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// DELETE /teams/:id/members/:userId
// Remove a member from a team
// ─────────────────────────────────────────
const removeTeamMember = async (req, res) => {
  try {
    const manager = req.gatewayUser;
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(req.params.id) ||
        !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const team = await Team.findOne({
      _id: req.params.id,
      organisationId: manager.organisationId,
    });

    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    if (manager.userRole === "manager" &&
        team.managerId.toString() !== manager.userId) {
      return res.status(403).json({
        success: false,
        message: "Managers can only modify their own teams",
      });
    }

    // Get the user's email to remove from memberEmails too
    const userToRemove = await User.findById(userId).select("email");

    team.memberIds = team.memberIds.filter((id) => id.toString() !== userId);
    if (userToRemove) {
      team.memberEmails = team.memberEmails.filter((e) => e !== userToRemove.email);
    }

    await team.save();

    res.status(200).json({
      success: true,
      message: "Member removed from team successfully",
      team,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createTeam,
  listTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
  addTeamMembers,
  removeTeamMember,
};
