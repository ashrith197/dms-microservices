const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    filename: {
      type: String,
      required: true,
      // original filename as uploaded by user
    },
    storedFilename: {
      type: String,
      required: true,
      // UUID-based name on disk — never the original name
    },
    filepath: {
      type: String,
      required: true,
      // normalized forward-slash path: uploads/{ownerId}/{storedFilename}
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      // in bytes
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    ownerId: {
      type: String,
      required: true,
      // from x-user-id header — permanent audit trail, NEVER changes
    },
    ownerEmail: {
      type: String,
      required: true,
      // from x-user-email header — permanent audit trail, NEVER changes
    },
    // ── NEW: Separated ownership ────────────────────────────────
    // ownerId / ownerEmail = NEVER changes. Permanent creator for audit trail.
    // currentOwnerId / currentOwnerEmail = live access control. Updated on reassignment.
    currentOwnerId: {
      type: String,
      required: true,         // set to ownerId on upload, updated on reassignment
    },
    currentOwnerEmail: {
      type: String,
      required: true,
    },
    // ── NEW: Multi-tenancy ──────────────────────────────
    organisationId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,           // nullable initially for migration — made required after
    },
    // ── NEW: Team scoping ───────────────────────────────
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,           // optional — document may not belong to a team
    },
    // ── NEW: Permission groups ──────────────────────────
    permissionGroupIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],             // empty = public to entire organisation
    },
    // ── NEW: Approval workflow ──────────────────────────
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "rejected"],
      default: "draft",
    },
    approvedBy: {
      type: String,            // userId of the manager who approved/rejected
      default: null,
    },
    approvalDate: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      // soft delete only — never physically remove
    },
  },
  { timestamps: true }
);

// Existing indexes
documentSchema.index({ ownerId: 1 });
documentSchema.index({ currentOwnerId: 1 });
documentSchema.index({ isDeleted: 1 });
documentSchema.index({ title: "text", category: "text", tags: "text" });

// New indexes
documentSchema.index({ organisationId: 1, isDeleted: 1 });
documentSchema.index({ status: 1 });
documentSchema.index({ teamId: 1 });

module.exports = mongoose.model("Document", documentSchema);
