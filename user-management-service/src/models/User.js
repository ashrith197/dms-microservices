const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name:           { type: String },
    email:          { type: String },
    password:       { type: String, select: false },   // never return password
    role:           { type: String, enum: ["employee", "manager", "admin"] },
    organisationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organisation", default: null },
  },
  { timestamps: true, collection: "users" }            // explicit collection name
);

userSchema.index({ organisationId: 1 });

module.exports = mongoose.model("User", userSchema);
