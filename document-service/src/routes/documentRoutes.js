const express = require("express");
const router = express.Router();
const { upload } = require("../middleware/uploadMiddleware");
const {
  uploadDocument,
  getDocuments,
  getDocumentById,
  downloadDocument,
  updateDocument,
  deleteDocument,
} = require("../controllers/documentController");
const {
  submitForApproval,
  approveDocument,
  rejectDocument,
} = require("../controllers/approvalController");

const handleUpload = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: `File too large. Maximum allowed size is ${process.env.MAX_FILE_SIZE_MB || 10}MB`,
        });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// Approval workflow — before /:id to prevent route shadowing
router.post("/:id/submit-for-approval", submitForApproval);
router.post("/:id/approve",             approveDocument);
router.post("/:id/reject",              rejectDocument);

// Core CRUD
router.post("/", handleUpload, uploadDocument);
router.get("/", getDocuments);
router.get("/:id/download", downloadDocument);   // ← before /:id to prevent route shadowing
router.get("/:id", getDocumentById);
router.patch("/:id", updateDocument);
router.delete("/:id", deleteDocument);

module.exports = router;
