const mongoose = require("mongoose");

// Read-only mirror of Document Service's Document model.
// Connects to document_db — the same database Document Service writes to.
// This service NEVER writes, updates, or deletes documents.
// Field names must be IDENTICAL to Document Service schema.
// collection: "documents" is explicit to prevent Mongoose pluralization issues.

const documentSchema = new mongoose.Schema(
  {
    title:          { type: String },
    filename:       { type: String },
    storedFilename: { type: String },
    filepath:       { type: String },
    mimetype:       { type: String },
    size:           { type: Number },
    category:       { type: String },
    tags:           { type: [String] },
    ownerId:        { type: String },
    ownerEmail:     { type: String },
    isDeleted:      { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "documents",   // Explicitly target Document Service's collection
  }
);

// Declare indexes — matches Document Service's indexes exactly.
// MongoDB won't recreate them if they already exist.
// Declaring here makes query planning explicit.
documentSchema.index({ ownerId: 1 });
documentSchema.index({ isDeleted: 1 });
documentSchema.index({ title: "text", category: "text", tags: "text" }); // Used by $text search
documentSchema.index({ createdAt: -1 });  // For date sorting
documentSchema.index({ category: 1 });    // For category filters
documentSchema.index({ mimetype: 1 });    // For mimetype filters

module.exports = mongoose.model("Document", documentSchema);
