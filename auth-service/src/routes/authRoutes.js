const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { register, login, verifyToken } = require("../controllers/authController");

// Rate Limiting Configuration - ONLY for login and register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes with rate limiting
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

// Internal route — called by other microservices (NO rate limiting)
router.get("/verify-token", verifyToken);

module.exports = router;
