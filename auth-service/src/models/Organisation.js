const mongoose = require("mongoose");

const organisationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organisation name is required"],
      trim: true,
      validate: {
        validator: function (value) {
          // Reject empty or whitespace-only strings after trimming
          return value && value.length > 0;
        },
        message: "Organisation name cannot be empty or whitespace-only",
      },
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Admin ID is required"],
    },
  },
  { timestamps: true }
);

// Index on adminId for efficient lookups
organisationSchema.index({ adminId: 1 });

module.exports = mongoose.model("Organisation", organisationSchema);
