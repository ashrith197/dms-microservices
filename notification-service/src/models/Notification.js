const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      required: true,
      enum: ["document_uploaded", "document_updated", "document_deleted"],
    },
    documentId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    ownerId: {
      type: String,
      required: true,
      // used to filter notifications per user
    },
    ownerEmail: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      default: null,
      // only present on document_uploaded events
    },
    isRead: {
      type: Boolean,
      default: false,
      // for read/unread tracking
    },
    timestamp: {
      type: Date,
      required: true,
      // from event payload, not server time
    },
  },
  { timestamps: true }    // createdAt = when received, timestamp = when event happened
);

// Compound indexes — match the exact query patterns in getNotifications
notificationSchema.index({ ownerId: 1, timestamp: -1 });           // base list query
notificationSchema.index({ ownerId: 1, event: 1, timestamp: -1 }); // filtered by event type

module.exports = mongoose.model("Notification", notificationSchema);
