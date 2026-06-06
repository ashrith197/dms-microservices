const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { sanitizeOwnerId } = require("../utils/helpers");

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const rawOwnerId = req.headers["x-user-id"];

    if (!rawOwnerId) {
      return cb(new Error("User ID header missing — request must come through API Gateway"), null);
    }

    const safeOwnerId = sanitizeOwnerId(rawOwnerId);
    const uploadPath = path.join(process.env.UPLOAD_DIR || "uploads", safeOwnerId);

    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const storedFilename = `${uuidv4()}${ext}`;
    cb(null, storedFilename);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Allowed types: PDF, DOCX, TXT, PNG, JPG`
      ),
      false
    );
  }
};

const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || "10");

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeMB * 1024 * 1024 },
});

module.exports = { upload };
