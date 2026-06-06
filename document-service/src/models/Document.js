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
      // from x-user-id header
    },
    ownerEmail: {
      type: String,
      required: true,
      // from x-user-email header
    },
    isDeleted: {
      type: Boolean,
      default: false,
      // soft delete only — never physically remove
    },
  },
  { timestamps: true }
);

documentSchema.index({ ownerId: 1 });
documentSchema.index({ isDeleted: 1 });
documentSchema.index({ title: "text", category: "text", tags: "text" });

module.exports = mongoose.model("Document", documentSchema);
