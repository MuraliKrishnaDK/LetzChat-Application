const {
  getStatuses,
  postTextStatus,
  postMediaStatus,
  viewStatus,
  deleteStatus,
} = require("../controllers/statusController");
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
    const ok = /jpeg|jpg|png|gif|webp|mp4|mov|webm/.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (ok || file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images and videos are allowed for status"));
    }
  },
});

router.post("/", getStatuses);
router.post("/text", postTextStatus);
router.post("/media", upload.single("status"), postMediaStatus);
router.post("/view", viewStatus);
router.delete("/:id", deleteStatus);

module.exports = router;
