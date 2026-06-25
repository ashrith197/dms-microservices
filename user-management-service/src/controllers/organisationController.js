const User = require("../models/User");
const Organisation = require("../models/Organisation");
const mongoose = require("mongoose");
const Team = require("../models/Team");
const axios = require("axios");
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
// POST /organisations/members/:userId/suspend
// Admin suspends an active employee
// Immediate effect — next request by this user returns 401
// ─────────────────────────────────────────
const suspendMember = async (req, res) => {
  try {
    const { userId } = req.params;
    const admin = req.gatewayUser;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    if (userId === admin.userId) {
      return res.status(403).json({
        success: false,
        message: "Admin cannot suspend their own account",
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
        message: "Cannot suspend another admin",
      });
    }

    if (targetUser.accountStatus === "suspended") {
      return res.status(409).json({
        success: false,
        message: "User is already suspended",
      });
    }

    if (targetUser.accountStatus === "archived") {
      return res.status(409).json({
        success: false,
        message: "User is already archived",
      });
    }

    // Remove from all teams immediately
    await Team.updateMany(
      { organisationId: admin.organisationId },
      {
        $pull: {
          memberIds: targetUser._id,
          memberEmails: targetUser.email,
        },
      }
    );

    // Suspend the account
    await User.findByIdAndUpdate(userId, {
      $set: {
        accountStatus: "suspended",
        suspendedAt: new Date(),
        suspendedBy: admin.userId,
      },
    });

    res.status(200).json({
      success: true,
      message: "User suspended successfully. Their next request will be blocked.",
      userId,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// POST /organisations/members/:userId/reassign
// Admin or Manager reassigns all documents from suspended user to another
// Body: { newOwnerId: "<userId>" }
// ─────────────────────────────────────────
const reassignMember = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newOwnerId } = req.body;
    const admin = req.gatewayUser;

    if (!newOwnerId) {
      return res.status(400).json({
        success: false,
        message: "newOwnerId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId) ||
        !mongoose.Types.ObjectId.isValid(newOwnerId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const suspendedUser = await User.findOne({
      _id: userId,
      organisationId: admin.organisationId,
      accountStatus: "suspended",
    });

    if (!suspendedUser) {
      return res.status(404).json({
        success: false,
        message: "Suspended user not found in your organisation",
      });
    }

    // FIX 1: Prevent double reassignment
    if (suspendedUser.reassignedTo) {
      return res.status(409).json({
        success: false,
        message: `Documents already reassigned to another user. Cannot reassign twice.`,
        alreadyReassignedTo: suspendedUser.reassignedTo,
      });
    }

    const newOwner = await User.findOne({
      _id: newOwnerId,
      organisationId: admin.organisationId,
      accountStatus: "active",
    });

    if (!newOwner) {
      return res.status(404).json({
        success: false,
        message: "New owner not found or not active in your organisation",
      });
    }

    // Call Document Service internal endpoint to bulk reassign
    try {
      await axios.patch(
        `${process.env.DOCUMENT_SERVICE_URL}/documents/internal/reassign`,
        {
          fromOwnerId:    userId,
          toOwnerId:      newOwnerId,
          toOwnerEmail:   newOwner.email,
          organisationId: admin.organisationId,
        },
        { timeout: 10000 }
      );
    } catch (err) {
      return res.status(503).json({
        success: false,
        message: "Document Service unavailable — reassignment could not complete",
      });
    }

    // Mark reassignment on suspended user record
    await User.findByIdAndUpdate(userId, {
      $set: { reassignedTo: newOwnerId },
    });

    res.status(200).json({
      success: true,
      message: `All documents reassigned from ${suspendedUser.email} to ${newOwner.email}`,
      from: suspendedUser.email,
      to: newOwner.email,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// POST /organisations/members/:userId/archive
// Admin permanently archives a suspended user
// Only allowed when no documents remain under their currentOwnerId
// ─────────────────────────────────────────
const archiveMember = async (req, res) => {
  try {
    const { userId } = req.params;
    const admin = req.gatewayUser;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const suspendedUser = await User.findOne({
      _id: userId,
      organisationId: admin.organisationId,
      accountStatus: "suspended",
    });

    if (!suspendedUser) {
      return res.status(404).json({
        success: false,
        message: "Suspended user not found. Only suspended users can be archived.",
      });
    }

    // Verify no documents remain under their currentOwnerId
    try {
      const checkResponse = await axios.get(
        `${process.env.DOCUMENT_SERVICE_URL}/documents/internal/owner-check/${userId}`,
        { timeout: 5000 }
      );
      if (checkResponse.data.documentCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot archive — ${checkResponse.data.documentCount} document(s) still assigned to this user. Complete reassignment first.`,
          remainingDocuments: checkResponse.data.documentCount,
        });
      }
    } catch (err) {
      return res.status(503).json({
        success: false,
        message: "Document Service unavailable — archive check could not complete",
      });
    }

    await User.findByIdAndUpdate(userId, {
      $set: {
        accountStatus: "archived",
        archivedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: "User archived successfully. Account is permanently inactive.",
      userId,
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
  listMembers,
  updateMemberRole,
  getUserById,
  getUsersByIds,
  suspendMember,
  reassignMember,
  archiveMember,
  // removeMember REMOVED — replaced by suspend/reassign/archive lifecycle
};
