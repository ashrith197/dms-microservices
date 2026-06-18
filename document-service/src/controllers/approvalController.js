const Document = require("../models/Document");
const { extractUserHeaders, extractOrgId } = require("../utils/helpers");
const axios = require("axios");

// Helper: fire approval event — reuse notification service pattern
const notifyApprovalEvent = (event, document, extra = {}) => {
  axios
    .post(
      `${process.env.NOTIFICATION_SERVICE_URL}/notifications/events`,
      {
        event,
        documentId: document._id,
        title: document.title,
        ownerId: document.ownerId,
        ownerEmail: document.ownerEmail,
        organisationId: document.organisationId,
        timestamp: new Date().toISOString(),
        ...extra,
      },
      { timeout: 3000 }
    )
    .catch((err) => {
      console.warn(`[Notification] Failed to send "${event}":`, err.message);
    });
};

// ─────────────────────────────────────────
// POST /documents/:id/submit-for-approval
// Employee submits their own draft document
// ─────────────────────────────────────────
const submitForApproval = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Missing required gateway headers.",
      });
    }

    const organisationId = extractOrgId(req);

    const query = { _id: req.params.id, isDeleted: false };
    if (organisationId) query.organisationId = organisationId;

    const document = await Document.findOne(query);

    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    // Only owner can submit
    if (document.ownerId !== user.ownerId) {
      return res.status(403).json({
        success: false,
        message: "Only the document owner can submit it for approval",
      });
    }

    // Must be in draft status
    if (document.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: `Document cannot be submitted — current status is '${document.status}'. Only 'draft' documents can be submitted.`,
      });
    }

    document.status = "pending_approval";
    await document.save();

    notifyApprovalEvent("document_submitted_for_approval", document);

    res.status(200).json({
      success: true,
      message: "Document submitted for approval successfully",
      document,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// POST /documents/:id/approve
// Manager approves a pending document
// ─────────────────────────────────────────
const approveDocument = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Missing required gateway headers.",
      });
    }

    if (!["manager", "admin"].includes(user.userRole)) {
      return res.status(403).json({
        success: false,
        message: "Only managers and admins can approve documents",
      });
    }

    const organisationId = extractOrgId(req);

    const query = { _id: req.params.id, isDeleted: false };
    if (organisationId) query.organisationId = organisationId;

    const document = await Document.findOne(query);

    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    if (document.status !== "pending_approval") {
      return res.status(400).json({
        success: false,
        message: `Document cannot be approved — current status is '${document.status}'. Only 'pending_approval' documents can be approved.`,
      });
    }

    document.status = "approved";
    document.approvedBy = user.ownerId;
    document.approvalDate = new Date();
    document.rejectionReason = null;
    await document.save();

    notifyApprovalEvent("document_approved", document, {
      approvedBy: user.userName,
      approvedByEmail: user.ownerEmail,
    });

    res.status(200).json({
      success: true,
      message: "Document approved successfully",
      document,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// POST /documents/:id/reject
// Manager rejects a pending document with reason
// ─────────────────────────────────────────
const rejectDocument = async (req, res) => {
  try {
    const user = extractUserHeaders(req);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Missing required gateway headers.",
      });
    }

    if (!["manager", "admin"].includes(user.userRole)) {
      return res.status(403).json({
        success: false,
        message: "Only managers and admins can reject documents",
      });
    }

    const { reason } = req.body;
    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is required",
      });
    }

    const organisationId = extractOrgId(req);

    const query = { _id: req.params.id, isDeleted: false };
    if (organisationId) query.organisationId = organisationId;

    const document = await Document.findOne(query);

    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    if (document.status !== "pending_approval") {
      return res.status(400).json({
        success: false,
        message: `Document cannot be rejected — current status is '${document.status}'. Only 'pending_approval' documents can be rejected.`,
      });
    }

    document.status = "rejected";
    document.approvedBy = user.ownerId;
    document.approvalDate = new Date();
    document.rejectionReason = reason.trim();
    await document.save();

    notifyApprovalEvent("document_rejected", document, {
      rejectedBy: user.userName,
      rejectedByEmail: user.ownerEmail,
      reason: reason.trim(),
    });

    res.status(200).json({
      success: true,
      message: "Document rejected",
      document,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { submitForApproval, approveDocument, rejectDocument };
