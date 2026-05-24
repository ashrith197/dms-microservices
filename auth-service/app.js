require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const authRoutes = require("./src/routes/authRoutes");
const validateEnv = require("./src/config/validateEnv");

const app = express();

// CORS Configuration - Only allow your frontend domain
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Mount auth routes (rate limiting applied per-route in authRoutes.js)
app.use("/auth", authRoutes);

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "Auth Service Running", port: process.env.PORT });
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

const start = async () => {
  validateEnv(["PORT", "MONGO_URI", "JWT_SECRET", "INTERNAL_SERVICE_KEY"]);
  await connectDB();

  app.listen(process.env.PORT, () => {
    console.log(`Auth Service running on port ${process.env.PORT}`);
  });
};

if (require.main === module) {
  start().catch((err) => {
    console.error("Failed to start Auth Service:", err.message);
    process.exit(1);
  });
}

module.exports = { app, start };
