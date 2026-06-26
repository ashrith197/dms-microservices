const mongoose = require("mongoose");

const eventLogSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      required: true,
      enum: [
        "document_uploaded",
        "document_updated",
        "document_deleted",
        "document_submitted_for_approval",
        "document_approved",
        "document_rejected",
        "documents_reassigned",           // ← NEW offboarding event
      ],
    },
    documentId:     { type: String, default: null },
    title:          { type: String, default: null },
    ownerId:        { type: String, default: null },
    currentOwnerId: { type: String, default: null },  // ← NEW
    ownerEmail:     { type: String, default: null },
    organisationId: { type: mongoose.Schema.Types.ObjectId, default: null },
    teamId:         { type: mongoose.Schema.Types.ObjectId, default: null },
    filename:       { type: String, default: null },
    metadata:       { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp:      { type: Date, required: true },
  },
  { timestamps: true }
);

eventLogSchema.index({ ownerId: 1, timestamp: -1 });
eventLogSchema.index({ organisationId: 1, timestamp: -1 });
eventLogSchema.index({ event: 1, timestamp: -1 });

module.exports = mongoose.model("EventLog", eventLogSchema);
