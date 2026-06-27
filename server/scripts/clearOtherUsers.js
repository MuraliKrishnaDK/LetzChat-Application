/**
 * Removes all users except the given username and their related data.
 * Usage: node scripts/clearOtherUsers.js [usernameToKeep]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/userModel");
const Messages = require("../models/messageModel");
const Block = require("../models/blockModel");
const Group = require("../models/groupModel");
const PasswordReset = require("../models/passwordResetModel");

const keepUsername = process.argv[2] || "chrisdale";

async function main() {
  await mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const keepUser = await User.findOne({ username: keepUsername });
  if (!keepUser) {
    console.log(`User "${keepUsername}" not found. Nothing deleted.`);
    await mongoose.disconnect();
    return;
  }

  const keepId = String(keepUser._id);
  const others = await User.find({ _id: { $ne: keepUser._id } });
  const otherIds = others.map((u) => String(u._id));
  const otherEmails = others.map((u) => u.email);

  if (otherIds.length === 0) {
    console.log("No other users to remove.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Removing ${otherIds.length} user(s): ${others.map((u) => u.username).join(", ")}`);

  await Messages.deleteMany({
    $or: [
      { sender: { $in: otherIds } },
      { users: { $in: otherIds } },
    ],
  });

  await Block.deleteMany({
    $or: [
      { blocker: { $in: otherIds } },
      { blocked: { $in: otherIds } },
    ],
  });

  await Group.deleteMany({ createdBy: { $in: otherIds } });
  await Group.updateMany(
    { members: { $in: otherIds } },
    { $pull: { members: { $in: otherIds } } }
  );

  if (otherEmails.length) {
    await PasswordReset.deleteMany({ email: { $in: otherEmails } });
  }

  await User.deleteMany({ _id: { $in: otherIds } });

  console.log(`Kept user: ${keepUsername} (${keepId})`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
