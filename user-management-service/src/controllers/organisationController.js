const User = require("../models/User");
const Organisation = require("../models/Organisation");
const mongoose = require("mongoose");

// ─────────────────────────────────────────
// POST /organisations/members/:userId
// Admin links an existing user to their organisation
// ─────────────────────────────────────────
const addMember = async (req, res) => {
  try {
    const { userId } = req.params;
    const admin = req.gatewayUser;

    if (!admin.organisationId) {
      return res.status(400).json({
        success: false,
        message: "Admin does not belong to an organisation",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (targetUser.organisationId) {
      return res.status(409).json({
        success: false,
        message: "User already belongs to an organisation",
      });
    }

    if (targetUser.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot add another admin to your organisation",
      });
    }

    targetUser.organisationId = admin.organisationId;
    await targetUser.save();

    res.status(200).json({
      success: true,
      message: "User added to organisation successfully",
      user: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        organisationId: targetUser.organisationId,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// DELETE /organisations/members/:userId
// Admin removes a user from their organisation
// ─────────────────────────────────────────
const removeMember = async (req, res) => {
  try {
    const { userId } = req.params;
    const admin = req.gatewayUser;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    // Prevent admin from removing themselves
    if (userId === admin.userId) {
      return res.status(403).json({
        success: false,
        message: "Admin cannot remove themselves from the organisation",
      });
    }

    const targetUser = await User.findOne({
      _id: userId,
      organisationId: admin.organisationId,
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found in your organisation",
      });
    }

    targetUser.organisationId = null;
    await targetUser.save();

    res.status(200).json({
      success: true,
      message: "User removed from organisation successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// GET /organisations/members
// Admin lists all members of their organisation
// ─────────────────────────────────────────
const listMembers = async (req, res) => {
  try {
    const admin = req.gatewayUser;

    if (!admin.organisationId) {
      return res.status(400).json({
        success: false,
        message: "Admin does not belong to an organisation",
      });
    }

    const members = await User.find({
      organisationId: admin.organisationId,
    }).select("-password").sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: members.length,
      members,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// PATCH /organisations/members/:userId/role
// Admin updates a member's role
// ─────────────────────────────────────────
const updateMemberRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const admin = req.gatewayUser;

    if (!["employee", "manager"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be either 'employee' or 'manager'. Admin role cannot be assigned this way.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    // Prevent self role change
    if (userId === admin.userId) {
      return res.status(403).json({
        success: false,
        message: "Admin cannot change their own role",
      });
    }

    const targetUser = await User.findOne({
      _id: userId,
      organisationId: admin.organisationId,
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found in your organisation",
      });
    }

    if (targetUser.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot change the role of another admin",
      });
    }

    targetUser.role = role;
    await targetUser.save();

    res.status(200).json({
      success: true,
      message: `User role updated to '${role}' successfully`,
      user: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        organisationId: targetUser.organisationId,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// GET /users/:id — Internal use
// Fetch single user details (called by other services)
// ─────────────────────────────────────────
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// POST /users/by-ids — Internal use
// Bulk fetch users by array of IDs
// ─────────────────────────────────────────
const getUsersByIds = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "ids must be a non-empty array",
      });
    }

    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const users = await User.find({ _id: { $in: validIds } }).select("-password");

    res.status(200).json({ success: true, count: users.length, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  addMember,
  removeMember,
  listMembers,
  updateMemberRole,
  getUserById,
  getUsersByIds,
};
