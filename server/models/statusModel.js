const mongoose = require("mongoose");

const statusSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "video"],
      required: true,
    },
    content: { type: String, default: "" },
    caption: { type: String, default: "" },
    bgColor: { type: String, default: "#1a1a2e" },
    viewers: [
      {
        userId: String,
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// MongoDB TTL — auto-deletes documents after expiresAt
statusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Status", statusSchema);
