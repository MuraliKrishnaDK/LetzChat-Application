const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const groupRoutes = require("./routes/groups");
const Block = require("./models/blockModel");
const app = express();
const socket = require("socket.io");
require("dotenv").config();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("DB Connetion Successfull");
  })
  .catch((err) => {
    console.log(err.message);
  });

app.get("/ping", (_req, res) => {
  return res.json({ msg: "Ping Successful" });
});

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

const server = app.listen(process.env.PORT, () =>
  console.log(`Server started on ${process.env.PORT}`)
);
const io = socket(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

global.onlineUsers = new Map();
io.on("connection", (socket) => {
  global.chatSocket = socket;
  socket.on("add-user", (userId) => {
    onlineUsers.set(userId, socket.id);
  });

  const emitToMembers = (memberIds, from, emitFn) => {
    memberIds.forEach((uid) => {
      if (String(uid) === String(from)) return;
      const sid = onlineUsers.get(uid);
      if (sid) emitFn(sid);
    });
  };

  socket.on("send-msg", async (data) => {
    if (data.memberIds?.length && data.groupId) {
      emitToMembers(data.memberIds, data.from, (sid) => {
        socket.to(sid).emit("group-msg-recieve", {
          msg: data.msg,
          messageId: data.messageId,
          from: data.from,
          groupId: data.groupId,
        });
      });
      return;
    }
    const sendUserSocket = onlineUsers.get(data.to);
    if (!sendUserSocket) return;
    const blocked = await Block.findOne({
      blocker: String(data.to),
      blocked: String(data.from),
    })
      .select("_id")
      .lean();
    if (blocked) return;
    socket.to(sendUserSocket).emit("msg-recieve", {
      msg: data.msg,
      messageId: data.messageId,
      from: data.from,
    });
  });

  socket.on("send-file-msg", async (data) => {
    if (data.memberIds?.length && data.groupId) {
      emitToMembers(data.memberIds, data.from, (sid) => {
        socket.to(sid).emit("group-file-msg-recieve", {
          ...data.fileMsg,
          from: data.from,
          groupId: data.groupId,
        });
      });
      return;
    }
    const sendUserSocket = onlineUsers.get(data.to);
    if (!sendUserSocket) return;
    const blocked = await Block.findOne({
      blocker: String(data.to),
      blocked: String(data.from),
    })
      .select("_id")
      .lean();
    if (blocked) return;
    socket.to(sendUserSocket).emit("file-msg-recieve", {
      ...data.fileMsg,
      from: data.from,
    });
  });

  socket.on("delete-msg", (data) => {
    if (data.memberIds?.length) {
      emitToMembers(data.memberIds, data.from, (sid) => {
        socket.to(sid).emit("msg-deleted", {
          messageId: data.messageId,
          groupId: data.groupId,
        });
      });
      return;
    }
    const s = onlineUsers.get(data.to);
    if (s) socket.to(s).emit("msg-deleted", { messageId: data.messageId });
  });

  socket.on("edit-msg", (data) => {
    if (data.memberIds?.length) {
      emitToMembers(data.memberIds, data.from, (sid) => {
        socket.to(sid).emit("msg-edited", {
          messageId: data.messageId,
          text: data.text,
          groupId: data.groupId,
        });
      });
      return;
    }
    const s = onlineUsers.get(data.to);
    if (s) socket.to(s).emit("msg-edited", { messageId: data.messageId, text: data.text });
  });

  socket.on("react-msg", (data) => {
    if (data.memberIds?.length) {
      emitToMembers(data.memberIds, data.from, (sid) => {
        socket.to(sid).emit("msg-reacted", {
          messageId: data.messageId,
          reactions: data.reactions,
          groupId: data.groupId,
        });
      });
      return;
    }
    const s = onlineUsers.get(data.to);
    if (s) socket.to(s).emit("msg-reacted", { messageId: data.messageId, reactions: data.reactions });
  });

  socket.on("pin-msg", (data) => {
    if (data.memberIds?.length) {
      emitToMembers(data.memberIds, data.from, (sid) => {
        socket.to(sid).emit("msg-pinned", {
          messageId: data.messageId,
          pinned: data.pinned,
          groupId: data.groupId,
        });
      });
      return;
    }
    const s = onlineUsers.get(data.to);
    if (s) socket.to(s).emit("msg-pinned", { messageId: data.messageId, pinned: data.pinned });
  });
});
