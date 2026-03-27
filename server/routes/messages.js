const {
  addMessage, getMessages, addFileMessage,
  deleteMessage, editMessage, togglePin, addReaction,
  forwardMessage, getLastMessages, searchMessages,
  clearChat, deleteChat, toggleBlock, checkBlock,
  getGroupSharedContent,
} = require("../controllers/messageController");
const router = require("express").Router();
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExt = /jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv|webm|pdf|doc|docx|txt|zip|ogg|mp3|wav|m4a/;
    const extOk = allowedExt.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/") ||
      file.mimetype.startsWith("audio/") || file.mimetype === "application/pdf" ||
      file.mimetype.includes("document") || file.mimetype === "text/plain" ||
      file.mimetype === "application/zip";
    if (extOk || mimeOk) cb(null, true);
    else cb(new Error("File type not supported"));
  },
});

router.post("/addmsg/",          addMessage);
router.post("/getmsg/",          getMessages);
router.post("/search/",          searchMessages);
router.post("/lastmessages/",    getLastMessages);
router.post("/groupshared/",     getGroupSharedContent);
router.post("/addfilemsg/",      upload.single("file"), addFileMessage);
router.post("/forward/",         forwardMessage);
router.patch("/:id/delete",      deleteMessage);
router.patch("/:id/edit",        editMessage);
router.patch("/:id/pin",         togglePin);
router.patch("/:id/react",       addReaction);
router.post("/clearchat/",       clearChat);
router.post("/deletechat/",      deleteChat);
router.post("/block/",           toggleBlock);
router.post("/checkblock/",      checkBlock);

module.exports = router;
