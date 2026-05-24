const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { register, login, verifyToken } = require("../controllers/authController");
const {
  requireInternalServiceKey,
} = require("../middleware/internalServiceMiddleware");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

router.get("/verify-token", requireInternalServiceKey, verifyToken);

module.exports = router;
