const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Team name is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    memberIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    // Denormalized emails — stored so Document Service can include
    // them in RabbitMQ event payloads without querying User Management
    memberEmails: {
      type: [String],
      default: [],
    },
    organisationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organisation",
      required: true,
    },
  },
  { timestamps: true }
);

teamSchema.index({ organisationId: 1 });
teamSchema.index({ managerId: 1 });

module.exports = mongoose.model("Team", teamSchema);
