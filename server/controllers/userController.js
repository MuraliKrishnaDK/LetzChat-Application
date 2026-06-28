const crypto = require("crypto");
const User = require("../models/userModel");
const Messages = require("../models/messageModel");
const Block = require("../models/blockModel");
const Group = require("../models/groupModel");
const PasswordReset = require("../models/passwordResetModel");
const bcrypt = require("bcrypt");
const { sendResetCodeEmail } = require("../utils/emailService");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user)
      return res.json({ msg: "Incorrect Username or Password", status: false });
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.json({ msg: "Incorrect Username or Password", status: false });
    const userObj = user.toObject();
    delete userObj.password;
    return res.json({ status: true, user: userObj });
  } catch (ex) {
    next(ex);
  }
};

module.exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const usernameCheck = await User.findOne({ username });
    if (usernameCheck)
      return res.json({ msg: "Username already used", status: false });
    const emailCheck = await User.findOne({ email: normalizedEmail });
    if (emailCheck)
      return res.json({ msg: "Email already used", status: false });
    const hashedPassword = await bcrypt.hash(password, 10);
    const created = await User.create({
      email: normalizedEmail,
      username,
      password: hashedPassword,
    });
    const user = created.toObject();
    delete user.password;
    return res.json({ status: true, user });
  } catch (ex) {
    next(ex);
  }
};

module.exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({ _id: { $ne: req.params.id } }).select([
      "email",
      "username",
      "avatarImage",
      "deleted",
      "_id",
    ]);
    return res.json(users);
  } catch (ex) {
    next(ex);
  }
};

module.exports.setAvatar = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const avatarImage = req.body.image;
    const userData = await User.findByIdAndUpdate(
      userId,
      {
        isAvatarImageSet: true,
        avatarImage,
      },
      { new: true }
    );
    return res.json({
      isSet: userData.isAvatarImageSet,
      image: userData.avatarImage,
    });
  } catch (ex) {
    next(ex);
  }
};

module.exports.updateProfile = async (req, res, next) => {
  try {
    const { username, phone } = req.body;
    const userId = req.params.id;
    if (username) {
      const existing = await User.findOne({ username, _id: { $ne: userId } });
      if (existing) return res.json({ msg: "Username already taken", status: false });
    }
    const updated = await User.findByIdAndUpdate(
      userId,
      { ...(username && { username }), phone: phone || "" },
      { new: true }
    ).select("-password");
    return res.json({ status: true, user: updated });
  } catch (ex) {
    next(ex);
  }
};

module.exports.logOut = (req, res, next) => {
  try {
    if (!req.params.id) return res.json({ msg: "User id is required " });
    if (global.onlineUsers) global.onlineUsers.delete(req.params.id);
    return res.status(200).send();
  } catch (ex) {
    next(ex);
  }
};

module.exports.deleteAccount = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) return res.json({ msg: "User not found", status: false });

    const uid = String(userId);

    // Remove the user from any groups they belong to; delete groups they owned
    const ownedGroupIds = await Group.find({ createdBy: uid }).distinct("_id");
    if (ownedGroupIds.length) {
      await Group.deleteMany({ _id: { $in: ownedGroupIds } });
    }
    await Group.updateMany({ members: uid }, { $pull: { members: uid } });

    // Clear block records and reset credentials
    await Block.deleteMany({ $or: [{ blocker: uid }, { blocked: uid }] });
    await PasswordReset.deleteMany({ email: user.email });

    // Soft-delete: wipe all PII but keep the document so existing DM history
    // still has a valid sender reference.  Messages are intentionally kept.
    // Use uid-suffixed placeholders so the unique indexes on username/email
    // are never violated when multiple accounts are deleted.
    await User.findByIdAndUpdate(
      userId,
      {
        deleted: true,
        username: `deleted_${uid}`,
        email: `deleted_${uid}@deleted.local`,
        password: "",
        phone: "",
        avatarImage: "",
        isAvatarImageSet: false,
      },
      { runValidators: false }
    );

    // Remove from online users map
    if (global.onlineUsers) global.onlineUsers.delete(uid);

    // Notify all connected clients so friends' UIs update in real-time
    if (global.io) {
      global.io.emit("user-deleted", { userId: uid });
    }

    return res.json({ status: true, msg: "Account deleted." });
  } catch (ex) {
    next(ex);
  }
};

module.exports.requestPasswordReset = async (req, res, next) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    if (!normalizedEmail) {
      return res.json({ msg: "Email is required", status: false });
    }

    const user = await User.findOne({
      email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i"),
    });
    if (!user) {
      return res.json({ msg: "No account found with that email", status: false });
    }

    const storedEmail = normalizeEmail(user.email);
    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await PasswordReset.deleteMany({ email: storedEmail });
    await PasswordReset.create({ email: storedEmail, code, expiresAt });

    const emailResult = await sendResetCodeEmail(user.email, code);

    if (!emailResult.sent) {
      if (process.env.NODE_ENV !== "production") {
        return res.json({
          status: true,
          msg: "SMTP is not configured. Use the code shown below to continue.",
          devCode: code,
        });
      }
      await PasswordReset.deleteMany({ email: storedEmail });
      return res.json({
        status: false,
        msg: "Email service is not configured. Add Gmail SMTP settings to server/.env.",
      });
    }

    return res.json({
      status: true,
      msg: "Reset code sent to your email.",
    });
  } catch (ex) {
    if (ex.message) {
      return res.json({
        status: false,
        msg: `Could not send email: ${ex.message}`,
      });
    }
    next(ex);
  }
};

const findValidResetRecord = async (emailInput, codeInput) => {
  const normalizedEmail = normalizeEmail(emailInput);
  const code = String(codeInput || "").trim();

  if (!normalizedEmail || !code) {
    return { error: "Email and code are required" };
  }

  const user = await User.findOne({
    email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i"),
  });
  if (!user) {
    return { error: "Invalid or expired code" };
  }

  const storedEmail = normalizeEmail(user.email);
  const record = await PasswordReset.findOne({ email: storedEmail, code });

  if (!record || record.expiresAt < new Date()) {
    return { error: "Invalid or expired code" };
  }

  return { user, record, storedEmail, code };
};

module.exports.verifyPasswordResetCode = async (req, res, next) => {
  try {
    const result = await findValidResetRecord(req.body.email, req.body.code);
    if (result.error) {
      return res.json({ msg: result.error, status: false });
    }
    return res.json({ status: true, msg: "Code verified." });
  } catch (ex) {
    next(ex);
  }
};

module.exports.resetPasswordWithCode = async (req, res, next) => {
  try {
    const { password } = req.body;
    const result = await findValidResetRecord(req.body.email, req.body.code);

    if (result.error) {
      return res.json({ msg: result.error, status: false });
    }

    if (!password) {
      return res.json({
        msg: "Password is required",
        status: false,
      });
    }

    if (password.length < 8) {
      return res.json({
        msg: "Password must be at least 8 characters",
        status: false,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.updateOne({ _id: result.user._id }, { password: hashedPassword });
    await PasswordReset.deleteMany({ email: result.storedEmail });

    return res.json({
      status: true,
      msg: "Password updated successfully.",
    });
  } catch (ex) {
    next(ex);
  }
};
