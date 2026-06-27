const {
  login,
  register,
  getAllUsers,
  setAvatar,
  logOut,
  updateProfile,
  deleteAccount,
  requestPasswordReset,
  verifyPasswordResetCode,
  resetPasswordWithCode,
} = require("../controllers/userController");

const router = require("express").Router();

router.post("/login", login);
router.post("/register", register);
router.get("/allusers/:id", getAllUsers);
router.post("/setavatar/:id", setAvatar);
router.get("/logout/:id", logOut);
router.patch("/profile/:id", updateProfile);
router.delete("/account/:id", deleteAccount);
router.post("/password-reset/request", requestPasswordReset);
router.post("/password-reset/verify", verifyPasswordResetCode);
router.post("/password-reset/confirm", resetPasswordWithCode);

module.exports = router;
