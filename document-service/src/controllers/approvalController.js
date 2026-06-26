const Document = require("../models/Document");
const { extractUserHeaders, extractOrgId } = require("../utils/helpers");
const axios = require("axios");
const { publishEvent } = require("../services/queueService");

// Helper: fire approval event — publish to RabbitMQ
const notifyApprovalEvent = (event, document, extra = {}) => {
  // Convert event name to routing key: document_submitted_for_approval -> document.submitted_for_approval
  // Keep underscores in "submitted_for_approval" together
  let routingKey;
  if (event === "document_submitted_for_approval") {
    routingKey = "document.submitted_for_approval";
  } else {
    routingKey = event.replace(/_/g, ".");
  }
  
  const payload = {
    event,
    documentId: document._id,
    title: document.title,
    ownerId: document.ownerId,
    ownerEmail: document.ownerEmail,
    organisationId: document.organisationId,
    timestamp: new Date().toISOString(),
    metadata: extra,
  };
  
  publishEvent(routingKey, payload);
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
    console.log(req.headers);
    const query = { _id: req.params.id, isDeleted: false };
    if (organisationId) query.organisationId = organisationId;
    console.log(query);
    console.log(organisationId);
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

    // Fetch manager email for notification
    let managerEmail = null;
    if (document.teamId) {
      try {
        const teamResponse = await axios.get(
          `${process.env.USER_MANAGEMENT_SERVICE_URL}/teams/${document.teamId}`,
          {
            headers: {
              "x-user-id": user.ownerId,
              "x-user-role": user.userRole,
              "x-organisation-id": document.organisationId?.toString() || "",
            },
            timeout: 5000,
          }
        );
        const team = teamResponse.data.team;
        if (team.managerEmail) {
          managerEmail = team.managerEmail;
        }
      } catch (err) {
        console.warn("[Submit] Could not fetch team manager email:", err.message);
      }
    }

    notifyApprovalEvent("document_submitted_for_approval", document, {
      managerEmail,
      ownerName: user.userName,
    });

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
    // If document belongs to a team, only that team's manager can approve/reject
    if (document.teamId && user.userRole === "manager") {
      try {
        const teamResponse = await axios.get(
          `${process.env.USER_MANAGEMENT_SERVICE_URL}/teams/${document.teamId}`,
          {
            headers: {
              "x-user-id": user.ownerId,
              "x-user-role": user.userRole,
              "x-organisation-id": document.organisationId?.toString() || "",
            },
            timeout: 5000,
          }
        );

        const team = teamResponse.data.team;

        if (team.managerId.toString() !== user.ownerId) {
          return res.status(403).json({
            success: false,
            message: "Only the manager of the document's team can approve or reject it",
          });
        }
      } catch (err) {
        return res.status(503).json({
          success: false,
          message: "Could not verify team manager — User Management Service unavailable",
        });
      }
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
    // If document belongs to a team, only that team's manager can approve/reject
    if (document.teamId && user.userRole === "manager") {
      try {
        const teamResponse = await axios.get(
          `${process.env.USER_MANAGEMENT_SERVICE_URL}/teams/${document.teamId}`,
          {
            headers: {
              "x-user-id": user.ownerId,
              "x-user-role": user.userRole,
              "x-organisation-id": document.organisationId?.toString() || "",
            },
            timeout: 5000,
          }
        );

        const team = teamResponse.data.team;

        if (team.managerId.toString() !== user.ownerId) {
          return res.status(403).json({
            success: false,
            message: "Only the manager of the document's team can approve or reject it",
          });
        }
      } catch (err) {
        return res.status(503).json({
          success: false,
          message: "Could not verify team manager — User Management Service unavailable",
        });
      }
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
