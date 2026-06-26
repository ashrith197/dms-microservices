const mongoose = require("mongoose");

const notificationRecordSchema = new mongoose.Schema(
  {
    eventType:      { type: String, required: true },
    recipientEmail: { type: String, required: true },
    recipientId:    { type: String, default: null },
    organisationId: { type: mongoose.Schema.Types.ObjectId, default: null },
    subject:        { type: String },
    status: {
      type: String,
      enum: ["sent", "failed"],
      required: true,
    },
    errorMessage:   { type: String, default: null },
    sentAt:         { type: Date, default: Date.now },
  },
  { timestamps: true }
);

notificationRecordSchema.index({ recipientEmail: 1 });
notificationRecordSchema.index({ eventType: 1 });
notificationRecordSchema.index({ organisationId: 1 });

module.exports = mongoose.model("NotificationRecord", notificationRecordSchema);
