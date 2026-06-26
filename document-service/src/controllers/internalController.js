const Document = require("../models/Document");
const { notifyDocumentsReassigned } = require("../services/notificationService");

// ─────────────────────────────────────────
// PATCH /documents/internal/reassign
// Bulk reassign documents from one owner to another
// Called by User Management Service during offboarding
// ─────────────────────────────────────────
const reassignDocuments = async (req, res) => {
  try {
    const { fromOwnerId, toOwnerId, toOwnerEmail, organisationId } = req.body;
    if (!fromOwnerId || !toOwnerId || !toOwnerEmail) {
      return res.status(400).json({
        success: false,
        message: "fromUserId, toUserId, and toUserEmail are required",
      });
    }

    // Build query to find all documents owned by the user being offboarded
    const query = {
      currentOwnerId: fromOwnerId,
      isDeleted: false,
    };

    if (organisationId) {
      query.organisationId = organisationId;
    }

    // Update all matching documents
    const result = await Document.updateMany(
      query,
      {
        $set: {
          currentOwnerId: toOwnerId,
          currentOwnerEmail: toOwnerEmail,
        },
      }
    );

    // Fire reassignment event
    notifyDocumentsReassigned({
      fromOwnerId,
      toOwnerId,
      toOwnerEmail,
      organisationId,
      count: result.modifiedCount,
    });

    res.status(200).json({
      success: true,
      message: `Reassigned ${result.modifiedCount} document(s) from ${fromOwnerId} to ${toOwnerId}`,
      count: result.modifiedCount,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// GET /documents/internal/owner-check/:userId
// Count documents owned by a user
// Called by User Management Service to validate archive eligibility
// ─────────────────────────────────────────
const checkOwnerDocuments = async (req, res) => {
  try {
    const { userId } = req.params;
    const { organisationId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    // Build query to count documents
    const query = {
      currentOwnerId: userId,
      isDeleted: false,
    };

    if (organisationId) {
      query.organisationId = organisationId;
    }

    const count = await Document.countDocuments(query);

    res.status(200).json({
      success: true,
      userId,
      documentCount: count,
      hasDocuments: count > 0,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  reassignDocuments,
  checkOwnerDocuments,
};
