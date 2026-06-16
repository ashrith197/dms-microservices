const mongoose = require("mongoose");

const organisationSchema = new mongoose.Schema(
  {
    name:    { type: String },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "organisations" }
);

module.exports = mongoose.model("Organisation", organisationSchema);
