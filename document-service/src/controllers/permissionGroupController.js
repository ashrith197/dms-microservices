const PermissionGroup = require("../models/PermissionGroup");
const { extractUserHeaders, extractOrgId } = require("../utils/helpers");
const mongoose = require("mongoose");

// POST /documents/permission-groups
const createPermissionGroup = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) return res.status(400).json({ success: false, message: "Missing gateway headers." });

    if (!["manager", "admin"].includes(user.userRole)) {
      return res.status(403).json({ success: false, message: "Only managers and admins can create permission groups" });
    }

    const organisationId = extractOrgId(req);
    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Organisation ID is required" });
    }

    const { name, description, userIds, teamIds } = req.body;

    if (!name) return res.status(400).json({ success: false, message: "Permission group name is required" });

    const group = await PermissionGroup.create({
      name,
      description: description || "",
      userIds: userIds || [],
      teamIds: teamIds || [],
      organisationId,
      createdBy: user.ownerId,
    });

    res.status(201).json({ success: true, message: "Permission group created", group });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /documents/permission-groups
const listPermissionGroups = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) return res.status(400).json({ success: false, message: "Missing gateway headers." });

    const organisationId = extractOrgId(req);
    if (!organisationId) return res.status(400).json({ success: false, message: "Organisation ID is required" });

    const groups = await PermissionGroup.find({ organisationId }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: groups.length, groups });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /documents/permission-groups/:id
const getPermissionGroupById = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) return res.status(400).json({ success: false, message: "Missing gateway headers." });

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid group ID" });
    }

    const organisationId = extractOrgId(req);
    const group = await PermissionGroup.findOne({ _id: req.params.id, organisationId });

    if (!group) return res.status(404).json({ success: false, message: "Permission group not found" });

    res.status(200).json({ success: true, group });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /documents/permission-groups/:id
const updatePermissionGroup = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) return res.status(400).json({ success: false, message: "Missing gateway headers." });

    if (!["manager", "admin"].includes(user.userRole)) {
      return res.status(403).json({ success: false, message: "Only managers and admins can update permission groups" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid group ID" });
    }

    const organisationId = extractOrgId(req);
    const group = await PermissionGroup.findOne({ _id: req.params.id, organisationId });

    if (!group) return res.status(404).json({ success: false, message: "Permission group not found" });

    const allowed = ["name", "description", "userIds", "teamIds"];
    const updates = {};
    allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    const updated = await PermissionGroup.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, message: "Permission group updated", group: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /documents/permission-groups/:id
const deletePermissionGroup = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) return res.status(400).json({ success: false, message: "Missing gateway headers." });

    if (!["manager", "admin"].includes(user.userRole)) {
      return res.status(403).json({ success: false, message: "Only managers and admins can delete permission groups" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid group ID" });
    }

    const organisationId = extractOrgId(req);
    const group = await PermissionGroup.findOne({ _id: req.params.id, organisationId });

    if (!group) return res.status(404).json({ success: false, message: "Permission group not found" });

    await PermissionGroup.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: "Permission group deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createPermissionGroup,
  listPermissionGroups,
  getPermissionGroupById,
  updatePermissionGroup,
  deletePermissionGroup,
};
