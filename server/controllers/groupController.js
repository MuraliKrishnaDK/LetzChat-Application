const Group = require("../models/groupModel");
const Messages = require("../models/messageModel");
const User = require("../models/userModel");

exports.createGroup = async (req, res, next) => {
  try {
    const { creatorId, memberIds, name } = req.body;
    const trimmedName = name != null ? String(name).trim() : "";
    if (!trimmedName) {
      return res.status(400).json({ msg: "Group name is required." });
    }
    if (!creatorId || !Array.isArray(memberIds) || memberIds.length < 2) {
      return res.status(400).json({ msg: "Select more than 1 chat to create a group." });
    }
    const others = [...new Set(memberIds.map(String))].filter((id) => id !== String(creatorId));
    if (others.length < 2) {
      return res.status(400).json({ msg: "Select more than 1 chat to create a group." });
    }
    const members = [String(creatorId), ...others];
    const group = await Group.create({
      name: trimmedName,
      members,
      createdBy: String(creatorId),
    });
    const profiles = await User.find({ _id: { $in: members } }).select("username avatarImage _id").lean();
    const memberProfiles = profiles.map((p) => ({
      ...p,
      _id: p._id.toString(),
    }));
    res.json({
      group: {
        ...group.toObject(),
        _id: group._id.toString(),
        avatarImage: group.avatarImage || "",
      },
      memberProfiles,
    });
  } catch (ex) {
    next(ex);
  }
};

exports.updateGroupProfile = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { requesterId, name, avatarImage } = req.body;
    if (!requesterId) return res.status(400).json({ msg: "Missing requesterId." });
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found." });
    if (!group.members.map(String).includes(String(requesterId))) {
      return res.status(403).json({ msg: "Access denied." });
    }
    if (name != null) {
      const t = String(name).trim();
      if (t) group.name = t;
    }
    if (avatarImage !== undefined) {
      const s = String(avatarImage);
      group.avatarImage = s.length > 2_000_000 ? s.slice(0, 2_000_000) : s;
    }
    await group.save();
    res.json({
      name: group.name,
      avatarImage: group.avatarImage || "",
    });
  } catch (ex) {
    next(ex);
  }
};

exports.addMembers = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { requesterId, memberIds } = req.body;
    if (!requesterId || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ msg: "Select at least one member to add." });
    }
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found." });
    const reqStr = String(requesterId);
    if (!group.members.map(String).includes(reqStr)) {
      return res.status(403).json({ msg: "Access denied." });
    }
    const existing = new Set(group.members.map(String));
    const toAdd = [...new Set(memberIds.map(String))].filter((id) => id && !existing.has(id));
    if (toAdd.length === 0) {
      return res.status(400).json({ msg: "No new members to add." });
    }
    const found = await User.find({ _id: { $in: toAdd } }).select("_id").lean();
    if (found.length !== toAdd.length) {
      return res.status(400).json({ msg: "One or more users are invalid." });
    }
    group.members.push(...toAdd);
    await group.save();
    const profiles = await User.find({ _id: { $in: group.members } })
      .select("username avatarImage _id")
      .lean();
    const memberProfiles = profiles.map((p) => ({
      ...p,
      _id: p._id.toString(),
    }));
    res.json({
      members: group.members.map(String),
      memberProfiles,
    });
  } catch (ex) {
    next(ex);
  }
};

exports.leaveGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ msg: "Missing userId." });
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found." });
    const uid = String(userId);
    if (!group.members.map(String).includes(uid)) {
      return res.status(403).json({ msg: "Not a member." });
    }
    group.members = group.members.filter((m) => String(m) !== uid);
    if (group.members.length === 0) {
      await Messages.deleteMany({ groupId: group._id });
      await Group.deleteOne({ _id: group._id });
      return res.json({ left: true, groupDeleted: true, members: [] });
    }
    await group.save();
    res.json({ left: true, groupDeleted: false, members: group.members.map(String) });
  } catch (ex) {
    next(ex);
  }
};

exports.listMyGroups = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const groups = await Group.find({ members: userId }).lean();
    const out = await Promise.all(
      groups.map(async (g) => {
        const gid = g._id;
        const last = await Messages.findOne({ groupId: gid, clearedFor: { $ne: userId } })
          .sort({ createdAt: -1 })
          .lean();
        const profiles = await User.find({ _id: { $in: g.members } })
          .select("username avatarImage _id")
          .lean();
        const memberProfiles = profiles.map((p) => ({
          ...p,
          _id: p._id.toString(),
        }));
        let lastMessage = null;
        if (last) {
          lastMessage = {
            text: last.message.text,
            fileType: last.message.fileType,
            fileName: last.message.fileName,
            fromSelf: last.sender.toString() === String(userId),
            deleted: last.deleted,
            createdAt: last.createdAt,
          };
        }
        return {
          _id: gid.toString(),
          name: g.name,
          avatarImage: g.avatarImage || "",
          members: g.members.map(String),
          createdBy: String(g.createdBy),
          memberProfiles,
          lastMessage,
          createdAt: g.createdAt,
          updatedAt: g.updatedAt,
        };
      })
    );
    res.json(out);
  } catch (ex) {
    next(ex);
  }
};
