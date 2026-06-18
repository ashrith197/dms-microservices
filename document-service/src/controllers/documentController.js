const path = require("path");
const fs = require("fs");
const Document = require("../models/Document");
const { extractUserHeaders, parseTags, sanitizeOwnerId, extractOrgId } = require("../utils/helpers");
const { hasDocumentAccess } = require("../utils/permissionHelper");
const {
  notifyDocumentUploaded,
  notifyDocumentDeleted,
  notifyDocumentUpdated,
} = require("../services/notificationService");

// ─────────────────────────────────────────
// POST /documents — Upload
// ─────────────────────────────────────────
const uploadDocument = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: "Missing required gateway headers (x-user-id, x-user-email, x-user-role). Request must come through API Gateway.",
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const { title, category, tags, teamId, permissionGroupIds } = req.body;

    if (!title || !category) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Title and category are required",
      });
    }

    const organisationId = extractOrgId(req);

    // Build normalized filepath explicitly using sanitized ownerId.
    // Guarantees MongoDB stores uploads/{sanitizedUserId}/{uuid}.ext
    // independent of Windows path behavior.
    const safeOwnerId = sanitizeOwnerId(user.ownerId);
    const normalizedPath = path
      .join(process.env.UPLOAD_DIR || "uploads", safeOwnerId, req.file.filename)
      .replace(/\\/g, "/");

    // Parse permissionGroupIds if sent as JSON string
    let parsedPermissionGroupIds = [];
    if (permissionGroupIds) {
      try {
        parsedPermissionGroupIds = typeof permissionGroupIds === "string"
          ? JSON.parse(permissionGroupIds)
          : permissionGroupIds;
      } catch { parsedPermissionGroupIds = []; }
    }

    const document = await Document.create({
      title,
      category,
      tags: parseTags(tags),
      filename: req.file.originalname,
      storedFilename: req.file.filename,
      filepath: normalizedPath,         // always forward slashes
      mimetype: req.file.mimetype,
      size: req.file.size,
      ownerId: user.ownerId,
      ownerEmail: user.ownerEmail,
      organisationId: organisationId || null,
      teamId: teamId || null,
      permissionGroupIds: parsedPermissionGroupIds,
      status: "draft",
    });

    notifyDocumentUploaded(document);

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      document,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// GET /documents — List
// ─────────────────────────────────────────
const getDocuments = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Missing required gateway headers. Request must come through API Gateway.",
      });
    }

    const organisationId = extractOrgId(req);
    const { status, teamId } = req.query;

    const query = { isDeleted: false };

    // Org scoping — always filter by org if available
    if (organisationId) query.organisationId = organisationId;

    // Role-based scoping
    if (user.userRole !== "admin") {
      query.ownerId = user.ownerId;
    }

    // Optional filters
    if (status) query.status = status;
    if (teamId) query.teamId = teamId;

    const documents = await Document.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: documents.length,
      documents,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// GET /documents/:id — Get single
// ─────────────────────────────────────────
const getDocumentById = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Missing required gateway headers. Request must come through API Gateway.",
      });
    }

    const organisationId = extractOrgId(req);

    const query = { _id: req.params.id, isDeleted: false };
    if (organisationId) query.organisationId = organisationId;

    const document = await Document.findOne(query);

    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    // Ownership check for non-admins
    if (user.userRole !== "admin" && document.ownerId !== user.ownerId) {
      return res.status(403).json({
        success: false,
        message: "Access denied — you do not own this document",
      });
    }

    // Permission group check
    const canAccess = await hasDocumentAccess(user.ownerId, user.userRole, document);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied — you do not have permission to view this document",
      });
    }

    res.status(200).json({ success: true, document });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// GET /documents/:id/download — Download
// ─────────────────────────────────────────
const downloadDocument = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Missing required gateway headers. Request must come through API Gateway.",
      });
    }

    const organisationId = extractOrgId(req);

    const query = { _id: req.params.id, isDeleted: false };
    if (organisationId) query.organisationId = organisationId;

    const document = await Document.findOne(query);

    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    if (user.userRole !== "admin" && document.ownerId !== user.ownerId) {
      return res.status(403).json({
        success: false,
        message: "Access denied — you do not own this document",
      });
    }

    const canAccess = await hasDocumentAccess(user.ownerId, user.userRole, document);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied — you do not have permission to download this document",
      });
    }

    const absolutePath = path.resolve(document.filepath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found on server",
      });
    }

    res.download(absolutePath, document.filename, (err) => {
      if (err) {
        console.error("Download error:", err.message);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: "Download failed" });
        }
      }
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// PATCH /documents/:id — Update metadata
// ─────────────────────────────────────────
const updateDocument = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Missing required gateway headers. Request must come through API Gateway.",
      });
    }

    const organisationId = extractOrgId(req);

    const query = { _id: req.params.id, isDeleted: false };
    if (organisationId) query.organisationId = organisationId;

    const document = await Document.findOne(query);

    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    if (user.userRole !== "admin" && document.ownerId !== user.ownerId) {
      return res.status(403).json({
        success: false,
        message: "Access denied — you do not own this document",
      });
    }

    // Whitelist — never allow updating ownerId, filepath, storedFilename, mimetype, size
    const allowedUpdates = ["title", "category", "tags", "teamId", "permissionGroupIds"];
    const updates = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        // Use shared parseTags for tags — same logic as upload
        updates[field] = field === "tags" ? parseTags(req.body[field]) : req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update. Allowed: title, category, tags, teamId, permissionGroupIds",
      });
    }

    const updated = await Document.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    notifyDocumentUpdated(updated);

    res.status(200).json({
      success: true,
      message: "Document updated successfully",
      document: updated,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// DELETE /documents/:id — Soft delete
// ─────────────────────────────────────────
const deleteDocument = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Missing required gateway headers. Request must come through API Gateway.",
      });
    }

    const organisationId = extractOrgId(req);

    const query = { _id: req.params.id, isDeleted: false };
    if (organisationId) query.organisationId = organisationId;

    const document = await Document.findOne(query);

    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    if (user.userRole !== "admin" && document.ownerId !== user.ownerId) {
      return res.status(403).json({
        success: false,
        message: "Access denied — you do not own this document",
      });
    }

    await Document.findByIdAndUpdate(req.params.id, { isDeleted: true });

    notifyDocumentDeleted(document);

    res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  uploadDocument,
  getDocuments,
  getDocumentById,
  downloadDocument,
  updateDocument,
  deleteDocument,
};
