const Status = require("../models/statusModel");
const path = require("path");
const multer = require("multer");

const EXPIRES_IN_MS = 24 * 60 * 60 * 1000;

/** GET /api/status — statuses for currentUser + their contacts */
module.exports.getStatuses = async (req, res, next) => {
  try {
    const { userId, contactIds = [] } = req.body;
    const allowedIds = [String(userId), ...contactIds.map(String)];
    const now = new Date();
    const statuses = await Status.find({
      userId: { $in: allowedIds },
      expiresAt: { $gt: now },
    })
      .populate("userId", "username avatarImage")
      .sort({ createdAt: 1 });
    return res.json(statuses);
  } catch (ex) {
    next(ex);
  }
};

/** POST /api/status/text */
module.exports.postTextStatus = async (req, res, next) => {
  try {
    const { userId, content, bgColor } = req.body;
    if (!content?.trim()) return res.json({ status: false, msg: "Content is required" });
    const expiresAt = new Date(Date.now() + EXPIRES_IN_MS);
    const created = await Status.create({
      userId,
      type: "text",
      content: content.trim(),
      bgColor: bgColor || "#1a1a2e",
      expiresAt,
    });
    const data = await created.populate("userId", "username avatarImage");
    return res.json({ status: true, data });
  } catch (ex) {
    next(ex);
  }
};

/** POST /api/status/media  (multipart/form-data — file field: "status") */
module.exports.postMediaStatus = async (req, res, next) => {
  try {
    const { userId, caption } = req.body;
    if (!req.file) return res.json({ status: false, msg: "No file provided" });
    const serverUrl = process.env.SERVER_URL || "http://localhost:5002";
    const content = `${serverUrl}/uploads/${req.file.filename}`;
    const type = req.file.mimetype.startsWith("video") ? "video" : "image";
    const expiresAt = new Date(Date.now() + EXPIRES_IN_MS);
    const created = await Status.create({
      userId,
      type,
      content,
      caption: caption?.trim() || "",
      expiresAt,
    });
    const data = await created.populate("userId", "username avatarImage");
    return res.json({ status: true, data });
  } catch (ex) {
    next(ex);
  }
};

/** POST /api/status/view */
module.exports.viewStatus = async (req, res, next) => {
  try {
    const { statusId, viewerId } = req.body;
    await Status.updateOne(
      { _id: statusId, "viewers.userId": { $ne: String(viewerId) } },
      { $push: { viewers: { userId: String(viewerId), viewedAt: new Date() } } }
    );
    return res.json({ status: true });
  } catch (ex) {
    next(ex);
  }
};

/** DELETE /api/status/:id */
module.exports.deleteStatus = async (req, res, next) => {
  try {
    const { userId } = req.body;
    await Status.deleteOne({ _id: req.params.id, userId });
    return res.json({ status: true });
  } catch (ex) {
    next(ex);
  }
};
