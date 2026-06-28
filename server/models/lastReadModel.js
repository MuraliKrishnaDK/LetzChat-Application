const mongoose = require("mongoose");

const lastReadSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  chatId: { type: String, required: true }, // partnerId for DMs, groupId for groups
  lastReadAt: { type: Date, default: Date.now },
});

lastReadSchema.index({ userId: 1, chatId: 1 }, { unique: true });

module.exports = mongoose.model("LastRead", lastReadSchema);
