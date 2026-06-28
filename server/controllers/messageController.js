const mongoose = require("mongoose");
const Messages = require("../models/messageModel");
const Block = require("../models/blockModel");
const Group = require("../models/groupModel");
const LastRead = require("../models/lastReadModel");

/** True if `recipientId` is blocking `senderId` (recipient should not see this incoming DM). */
const recipientBlocksSender = async (recipientId, senderId) => {
  const row = await Block.findOne({
    blocker: String(recipientId),
    blocked: String(senderId),
  })
    .select("_id")
    .lean();
  return !!row;
};

/** Mongo filter: DMs between viewer and partner visible to viewer (excludes block-suppressed for viewer). */
const dmVisibleToViewer = (viewerId, partnerId) => ({
  users: { $all: [viewerId, partnerId] },
  groupId: null,
  clearedFor: { $ne: viewerId },
  $nor: [{ hiddenForRecipients: String(viewerId) }],
});

const project = (msg, fromId) => ({
  _id: msg._id.toString(),
  fromSelf: msg.sender.toString() === fromId,
  senderId: msg.sender.toString(),
  message: msg.message.text,
  fileUrl: msg.message.fileUrl,
  fileType: msg.message.fileType,
  fileName: msg.message.fileName,
  deleted: msg.deleted,
  edited: msg.edited,
  editedAt: msg.editedAt,
  createdAt: msg.createdAt,
  pinned: msg.pinned,
  replyTo: msg.replyTo,
  reactions: msg.reactions,
});

module.exports.getMessages = async (req, res, next) => {
  try {
    const { from, to, groupId } = req.body;
    if (groupId) {
      const g = await Group.findById(groupId);
      if (!g || !g.members.map(String).includes(String(from))) {
        return res.status(403).json({ msg: "Access denied" });
      }
      const messages = await Messages.find({
        groupId,
        clearedFor: { $ne: from },
      }).sort({ updatedAt: 1 });
      return res.json(messages.map((m) => project(m, from)));
    }
    const messages = await Messages.find(dmVisibleToViewer(from, to)).sort({ updatedAt: 1 });
    res.json(messages.map((m) => project(m, from)));
  } catch (ex) {
    next(ex);
  }
};

module.exports.addMessage = async (req, res, next) => {
  try {
    const { from, to, message, replyTo, groupId } = req.body;
    if (groupId) {
      const g = await Group.findById(groupId);
      if (!g || !g.members.map(String).includes(String(from))) {
        return res.status(403).json({ msg: "Access denied" });
      }
      const data = await Messages.create({
        message: { text: message },
        users: g.members,
        sender: from,
        groupId,
        replyTo: replyTo || {},
      });
      if (data) return res.json({ msg: "Message added successfully.", messageId: data._id });
      return res.json({ msg: "Failed to add message to the database" });
    }
    const hiddenForRecipients = (await recipientBlocksSender(to, from)) ? [String(to)] : [];
    const data = await Messages.create({
      message: { text: message },
      users: [from, to],
      sender: from,
      replyTo: replyTo || {},
      hiddenForRecipients,
    });
    if (data) return res.json({ msg: "Message added successfully.", messageId: data._id });
    else return res.json({ msg: "Failed to add message to the database" });
  } catch (ex) {
    next(ex);
  }
};

module.exports.addFileMessage = async (req, res, next) => {
  try {
    const { from, to, groupId, caption } = req.body;
    const captionText = caption != null ? String(caption).trim() : "";
    const file = req.file;
    if (!file) return res.status(400).json({ msg: "No file uploaded" });

    const serverUrl = process.env.SERVER_URL || "http://localhost:5002";
    const fileUrl = `${serverUrl}/uploads/${file.filename}`;
    const fileType = file.mimetype.startsWith("image/")
      ? "image"
      : file.mimetype.startsWith("video/")
      ? "video"
      : file.mimetype.startsWith("audio/")
      ? "audio"
      : "file";

    if (groupId) {
      const g = await Group.findById(groupId);
      if (!g || !g.members.map(String).includes(String(from))) {
        return res.status(403).json({ msg: "Access denied" });
      }
      const data = await Messages.create({
        message: { text: captionText, fileUrl, fileType, fileName: file.originalname },
        users: g.members,
        sender: from,
        groupId,
      });
      if (data) {
        return res.json({
          msg: "File message added successfully.",
          messageId: data._id,
          fileUrl,
          fileType,
          fileName: file.originalname,
          message: captionText,
        });
      }
      return res.json({ msg: "Failed to add file message to the database" });
    }

    const hiddenForRecipients = (await recipientBlocksSender(to, from)) ? [String(to)] : [];
    const data = await Messages.create({
      message: { text: captionText, fileUrl, fileType, fileName: file.originalname },
      users: [from, to],
      sender: from,
      hiddenForRecipients,
    });

    if (data)
      return res.json({
        msg: "File message added successfully.",
        messageId: data._id,
        fileUrl,
        fileType,
        fileName: file.originalname,
        message: captionText,
      });
    else
      return res.json({ msg: "Failed to add file message to the database" });
  } catch (ex) {
    next(ex);
  }
};

module.exports.deleteMessage = async (req, res, next) => {
  try {
    const data = await Messages.findByIdAndUpdate(req.params.id, { deleted: true }, { new: true });
    if (data) return res.json({ msg: "Message deleted." });
    else return res.status(404).json({ msg: "Message not found." });
  } catch (ex) {
    next(ex);
  }
};

module.exports.editMessage = async (req, res, next) => {
  try {
    const { text } = req.body;
    const data = await Messages.findByIdAndUpdate(
      req.params.id,
      { "message.text": text, edited: true, editedAt: new Date() },
      { new: true }
    );
    if (data) return res.json({ msg: "Message edited." });
    else return res.status(404).json({ msg: "Message not found." });
  } catch (ex) {
    next(ex);
  }
};

module.exports.togglePin = async (req, res, next) => {
  try {
    const msg = await Messages.findById(req.params.id);
    if (!msg) return res.status(404).json({ msg: "Message not found." });
    msg.pinned = !msg.pinned;
    await msg.save();
    return res.json({ pinned: msg.pinned });
  } catch (ex) {
    next(ex);
  }
};

module.exports.addReaction = async (req, res, next) => {
  try {
    const { emoji, userId } = req.body;
    const msg = await Messages.findById(req.params.id);
    if (!msg) return res.status(404).json({ msg: "Message not found." });

    const existing = msg.reactions.find((r) => r.emoji === emoji);
    if (existing) {
      if (existing.userIds.includes(userId)) {
        existing.userIds = existing.userIds.filter((uid) => uid !== userId);
        if (existing.userIds.length === 0)
          msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
      } else {
        existing.userIds.push(userId);
      }
    } else {
      msg.reactions.push({ emoji, userIds: [userId] });
    }
    await msg.save();
    return res.json({ reactions: msg.reactions });
  } catch (ex) {
    next(ex);
  }
};

module.exports.forwardMessage = async (req, res, next) => {
  try {
    const { from, to, text, fileUrl, fileType, fileName } = req.body;
    const hiddenForRecipients = (await recipientBlocksSender(to, from)) ? [String(to)] : [];
    const data = await Messages.create({
      message: { text: text || "", fileUrl: fileUrl || "", fileType: fileType || "", fileName: fileName || "" },
      users: [from, to],
      sender: from,
      hiddenForRecipients,
    });
    if (data) return res.json({ msg: "Message forwarded.", messageId: data._id });
    else return res.json({ msg: "Failed to forward message" });
  } catch (ex) {
    next(ex);
  }
};

module.exports.getLastMessages = async (req, res, next) => {
  try {
    const { userId, contactIds } = req.body;
    const result = {};
    await Promise.all(
      contactIds.map(async (contactId) => {
        const lastMsg = await Messages.findOne(dmVisibleToViewer(userId, contactId)).sort({
          createdAt: -1,
        });
        if (lastMsg) {
          result[contactId] = {
            text: lastMsg.message.text,
            fileType: lastMsg.message.fileType,
            fileName: lastMsg.message.fileName,
            fromSelf: lastMsg.sender.toString() === userId,
            deleted: lastMsg.deleted,
            createdAt: lastMsg.createdAt,
          };
        }
      })
    );
    res.json(result);
  } catch (ex) {
    next(ex);
  }
};

// Mark messages as cleared only for the requesting user
module.exports.clearChat = async (req, res, next) => {
  try {
    const { from, to, groupId } = req.body;
    if (groupId) {
      const g = await Group.findById(groupId);
      if (!g || !g.members.map(String).includes(String(from))) {
        return res.status(403).json({ msg: "Access denied" });
      }
      await Messages.updateMany({ groupId }, { $addToSet: { clearedFor: from } });
      return res.json({ msg: "Chat cleared." });
    }
    if (!to) return res.status(400).json({ msg: "Missing fields" });
    await Messages.updateMany(
      { users: { $all: [from, to] }, groupId: null },
      { $addToSet: { clearedFor: from } }
    );
    return res.json({ msg: "Chat cleared." });
  } catch (ex) { next(ex); }
};

// Hard-delete every message in a conversation
module.exports.deleteChat = async (req, res, next) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) return res.status(400).json({ msg: "Missing fields" });
    const a = String(from);
    const b = String(to);
    if (a === b) return res.status(400).json({ msg: "Invalid participants" });

    const dmScope = {
      $or: [{ groupId: null }, { groupId: { $exists: false } }],
    };

    const variants = [{ users: { $all: [a, b] } }];
    if (mongoose.Types.ObjectId.isValid(a) && mongoose.Types.ObjectId.isValid(b)) {
      variants.push({
        users: {
          $all: [new mongoose.Types.ObjectId(a), new mongoose.Types.ObjectId(b)],
        },
      });
    }

    const result = await Messages.deleteMany({
      $and: [dmScope, { $or: variants }],
    });
    return res.json({ msg: "Chat deleted.", deletedCount: result.deletedCount });
  } catch (ex) {
    next(ex);
  }
};

// Toggle block: returns { blocked: true/false }
module.exports.toggleBlock = async (req, res, next) => {
  try {
    const { blockerId, blockedId } = req.body;
    const existing = await Block.findOne({ blocker: blockerId, blocked: blockedId });
    if (existing) {
      await Block.deleteOne({ blocker: blockerId, blocked: blockedId });
      return res.json({ blocked: false });
    }
    await Block.create({ blocker: blockerId, blocked: blockedId });
    return res.json({ blocked: true });
  } catch (ex) { next(ex); }
};

// Check if blockerId has blocked blockedId
module.exports.checkBlock = async (req, res, next) => {
  try {
    const { blockerId, blockedId } = req.body;
    const existing = await Block.findOne({ blocker: blockerId, blocked: blockedId });
    return res.json({ blocked: !!existing });
  } catch (ex) { next(ex); }
};

module.exports.searchMessages = async (req, res, next) => {
  try {
    const { userId, query } = req.body;
    if (!query || query.trim().length === 0) return res.json([]);
    const messages = await Messages.find({
      users: userId,
      "message.text": { $regex: query.trim(), $options: "i" },
      deleted: { $ne: true },
      clearedFor: { $ne: userId },
      $nor: [{ hiddenForRecipients: String(userId) }],
    })
      .sort({ createdAt: -1 })
      .limit(30);

    const results = messages.map((msg) => {
      const otherUserId = msg.users.find((u) => u.toString() !== userId);
      return {
        messageId: msg._id,
        text: msg.message.text,
        fromSelf: msg.sender.toString() === userId,
        otherUserId: otherUserId ? otherUserId.toString() : null,
        createdAt: msg.createdAt,
      };
    });
    res.json(results);
  } catch (ex) {
    next(ex);
  }
};

const URL_IN_TEXT = /https?:\/\/[^\s<>"'{}|\\^`[\]]+/gi;

module.exports.getGroupSharedContent = async (req, res, next) => {
  try {
    const { groupId, userId } = req.body;
    if (!groupId || !userId) return res.status(400).json({ msg: "Missing fields" });
    const g = await Group.findById(groupId);
    if (!g || !g.members.map(String).includes(String(userId))) {
      return res.status(403).json({ msg: "Access denied" });
    }

    const messages = await Messages.find({
      groupId,
      clearedFor: { $ne: userId },
      deleted: { $ne: true },
      $or: [
        { "message.fileUrl": { $nin: [null, ""] } },
        { "message.text": { $regex: /https?:\/\//i } },
      ],
    }).sort({ createdAt: -1 });

    const media = [];
    const docs = [];
    const links = [];

    const pushUrls = (text, msg, suffix = "") => {
      if (!text) return;
      const matches = text.match(URL_IN_TEXT);
      if (!matches) return;
      const seen = new Set();
      for (const raw of matches) {
        const url = raw.replace(/[),.]+$/g, "");
        if (seen.has(url)) continue;
        seen.add(url);
        links.push({
          _id: `${msg._id}${suffix}-${url}`,
          url,
          previewText: text.length > 100 ? `${text.slice(0, 100)}…` : text,
          createdAt: msg.createdAt,
        });
      }
    };

    for (const msg of messages) {
      const fu = (msg.message && msg.message.fileUrl) || "";
      const ft = (msg.message && msg.message.fileType) || "";
      const text = (msg.message && msg.message.text) || "";

      if (fu) {
        if (ft === "image" || ft === "video" || ft === "audio") {
          media.push({
            _id: msg._id.toString(),
            fileUrl: fu,
            fileType: ft,
            fileName: msg.message.fileName || "",
            caption: text,
            createdAt: msg.createdAt,
          });
        } else if (ft === "file") {
          docs.push({
            _id: msg._id.toString(),
            fileUrl: fu,
            fileName: msg.message.fileName || "",
            caption: text,
            createdAt: msg.createdAt,
          });
        }
        pushUrls(text, msg, "-cap");
      } else {
        pushUrls(text, msg, "");
      }
    }

    links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ media, docs, links });
  } catch (ex) {
    next(ex);
  }
};

/**
 * POST /api/messages/unread-counts
 * Body: { userId, chatIds: [{id, isGroup}] }
 * Returns: { [chatId]: count }
 */
module.exports.getUnreadCounts = async (req, res, next) => {
  try {
    const { userId, chatIds = [] } = req.body;
    if (!userId || !chatIds.length) return res.json({});

    const readRecords = await LastRead.find({
      userId: String(userId),
      chatId: { $in: chatIds.map((c) => String(c.id)) },
    }).lean();

    const readMap = {};
    readRecords.forEach((r) => { readMap[r.chatId] = r.lastReadAt; });

    const results = await Promise.all(
      chatIds.map(async ({ id, isGroup }) => {
        const chatId = String(id);
        const since = readMap[chatId] || new Date(0);
        let count;
        if (isGroup) {
          count = await Messages.countDocuments({
            groupId: new mongoose.Types.ObjectId(chatId),
            sender: { $ne: new mongoose.Types.ObjectId(String(userId)) },
            createdAt: { $gt: since },
            deleted: false,
            clearedFor: { $ne: String(userId) },
          });
        } else {
          count = await Messages.countDocuments({
            users: { $all: [String(userId), String(chatId)] },
            groupId: null,
            sender: { $ne: new mongoose.Types.ObjectId(String(userId)) },
            createdAt: { $gt: since },
            deleted: false,
            clearedFor: { $ne: String(userId) },
            $nor: [{ hiddenForRecipients: String(userId) }],
          });
        }
        return [chatId, count];
      })
    );

    const counts = {};
    results.forEach(([chatId, count]) => { if (count > 0) counts[chatId] = count; });
    return res.json(counts);
  } catch (ex) {
    next(ex);
  }
};

/**
 * POST /api/messages/mark-read
 * Body: { userId, chatId }
 */
module.exports.markChatRead = async (req, res, next) => {
  try {
    const { userId, chatId } = req.body;
    await LastRead.findOneAndUpdate(
      { userId: String(userId), chatId: String(chatId) },
      { lastReadAt: new Date() },
      { upsert: true }
    );
    return res.json({ status: true });
  } catch (ex) {
    next(ex);
  }
};
