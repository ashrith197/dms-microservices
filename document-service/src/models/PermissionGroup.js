const mongoose = require("mongoose");

const permissionGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Permission group name is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    // Direct user access
    userIds: {
      type: [String],          // store as string userIds (from x-user-id headers)
      default: [],
    },
    // Team-level access — all members of these teams get access
    teamIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    organisationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    createdBy: {
      type: String,            // userId of the manager who created it
      required: true,
    },
  },
  { timestamps: true }
);

permissionGroupSchema.index({ organisationId: 1 });

module.exports = mongoose.model("PermissionGroup", permissionGroupSchema);
