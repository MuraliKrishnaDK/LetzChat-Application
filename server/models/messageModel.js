const mongoose = require("mongoose");

const MessageSchema = mongoose.Schema(
  {
    message: {
      text: { type: String, default: "" },
      fileUrl: { type: String, default: "" },
      fileType: { type: String, default: "" },
      fileName: { type: String, default: "" },
    },
    users: Array,
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deleted: { type: Boolean, default: false },
    edited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    pinned: { type: Boolean, default: false },
    replyTo: {
      messageId: { type: String, default: "" },
      text: { type: String, default: "" },
      fileType: { type: String, default: "" },
      fileName: { type: String, default: "" },
      senderName: { type: String, default: "" },
    },
    reactions: [
      {
        emoji: { type: String },
        userIds: [{ type: String }],
      },
    ],
    // IDs of users who cleared this chat (message hidden only for them)
    clearedFor: [{ type: String, default: [] }],
    // DM only: recipient user ids who must not see this message (e.g. they blocked the sender when it was sent)
    hiddenForRecipients: [{ type: String, default: [] }],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Messages", MessageSchema);
