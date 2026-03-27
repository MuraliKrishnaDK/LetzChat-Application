const {
  login,
  register,
  getAllUsers,
  setAvatar,
  logOut,
  updateProfile,
} = require("../controllers/userController");

const router = require("express").Router();

router.post("/login", login);
router.post("/register", register);
router.get("/allusers/:id", getAllUsers);
router.post("/setavatar/:id", setAvatar);
router.get("/logout/:id", logOut);
router.patch("/profile/:id", updateProfile);

module.exports = router;
