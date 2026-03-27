const { createGroup, addMembers, listMyGroups, updateGroupProfile, leaveGroup } = require("../controllers/groupController");
const router = require("express").Router();

router.post("/create", createGroup);
router.get("/my/:userId", listMyGroups);
router.patch("/:groupId/profile", updateGroupProfile);
router.post("/:groupId/members", addMembers);
router.post("/:groupId/leave", leaveGroup);

module.exports = router;
