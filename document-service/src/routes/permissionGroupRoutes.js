const express = require("express");
const router = express.Router();
const {
  createPermissionGroup,
  listPermissionGroups,
  getPermissionGroupById,
  updatePermissionGroup,
  deletePermissionGroup,
} = require("../controllers/permissionGroupController");

router.post("/",     createPermissionGroup);
router.get("/",      listPermissionGroups);
router.get("/:id",   getPermissionGroupById);
router.patch("/:id", updatePermissionGroup);
router.delete("/:id", deletePermissionGroup);

module.exports = router;
