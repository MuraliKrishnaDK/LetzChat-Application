const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const groupRoutes = require("./routes/groups");
const Block = require("./models/blockModel");
const app = express();
const socket = require("socket.io");
require("dotenv").config();

app.set("trust proxy", 1);

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:3001")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (process.env.SERVER_URL && !allowedOrigins.includes(process.env.SERVER_URL)) {
  allowedOrigins.push(process.env.SERVER_URL);
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
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

// Serve React production build (Render monolith deploy)
const clientBuild = path.join(__dirname, "../public/build");
if (process.env.NODE_ENV === "production" && fs.existsSync(path.join(clientBuild, "index.html"))) {
  app.use(express.static(clientBuild));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientBuild, "index.html"));
  });
}

const PORT = process.env.PORT || 5002;
const server = app.listen(PORT, () =>
  console.log(`Server started on ${PORT}`)
);
const io = socket(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

global.onlineUsers = new Map();
const activeCalls = new Map();

const getUserSocket = (userId) => onlineUsers.get(String(userId));

const isBlockedBetween = async (blockerId, blockedId) => {
  const row = await Block.findOne({
    blocker: String(blockerId),
    blocked: String(blockedId),
  })
    .select("_id")
    .lean();
  return !!row;
};

const clearCall = (callId) => {
  for (const [userId, activeCallId] of activeCalls.entries()) {
    if (activeCallId === callId) activeCalls.delete(userId);
  }
};

io.on("connection", (socket) => {
  global.chatSocket = socket;

  socket.on("add-user", (userId) => {
    onlineUsers.set(String(userId), socket.id);
  });

  socket.on("disconnect", () => {
    for (const [userId, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        const callId = activeCalls.get(userId);
        if (callId) {
          for (const [uid, cid] of activeCalls.entries()) {
            if (cid === callId && uid !== userId) {
              const peerSocket = getUserSocket(uid);
              if (peerSocket) {
                io.to(peerSocket).emit("call-ended", { from: userId, callId });
              }
            }
          }
          clearCall(callId);
        }
        onlineUsers.delete(userId);
        break;
      }
    }
  });

  const emitToMembers = (memberIds, from, emitFn) => {
    memberIds.forEach((uid) => {
      if (String(uid) === String(from)) return;
      const sid = onlineUsers.get(String(uid));
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
    const sendUserSocket = getUserSocket(data.to);
    if (!sendUserSocket) return;
    const blocked = await isBlockedBetween(data.to, data.from);
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
    const sendUserSocket = getUserSocket(data.to);
    if (!sendUserSocket) return;
    const blocked = await isBlockedBetween(data.to, data.from);
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
    const s = getUserSocket(data.to);
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
    const s = getUserSocket(data.to);
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
    const s = getUserSocket(data.to);
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
    const s = getUserSocket(data.to);
    if (s) socket.to(s).emit("msg-pinned", { messageId: data.messageId, pinned: data.pinned });
  });

  // ── WebRTC call signaling ──────────────────────────────────────────────────
  socket.on("call-offer", async (data) => {
    const { from, to, offer, callId, isVideo, callerName } = data;
    if (await isBlockedBetween(to, from)) return;

    const calleeSocket = getUserSocket(to);
    if (!calleeSocket) {
      socket.emit("call-unavailable", { to, callId });
      return;
    }
    if (activeCalls.has(String(to)) || activeCalls.has(String(from))) {
      socket.emit("call-busy", { to, callId });
      return;
    }

    activeCalls.set(String(from), callId);
    activeCalls.set(String(to), callId);
    io.to(calleeSocket).emit("incoming-call", {
      from,
      offer,
      callId,
      isVideo,
      callerName,
    });
  });

  socket.on("call-answer", (data) => {
    const { from, to, answer, callId } = data;
    const callerSocket = getUserSocket(to);
    if (!callerSocket) return;
    io.to(callerSocket).emit("call-accepted", { from, answer, callId });
  });

  socket.on("ice-candidate", (data) => {
    const { from, to, candidate, callId } = data;
    const peerSocket = getUserSocket(to);
    if (!peerSocket) return;
    io.to(peerSocket).emit("ice-candidate", { from, candidate, callId });
  });

  socket.on("call-reject", (data) => {
    const { from, to, callId } = data;
    clearCall(callId);
    const callerSocket = getUserSocket(to);
    if (callerSocket) {
      io.to(callerSocket).emit("call-rejected", { from, callId });
    }
  });

  socket.on("call-end", (data) => {
    const { from, to, callId } = data;
    clearCall(callId);
    const peerSocket = getUserSocket(to);
    if (peerSocket) {
      io.to(peerSocket).emit("call-ended", { from, callId });
    }
  });
});
