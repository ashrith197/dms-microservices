require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./db");
const validateEnv = require("./src/config/validateEnv");
const notificationRoutes = require("./src/routes/notificationRoutes");

const app = express();

// Internal-only CORS — only Document Service should be calling this
const corsOptions = {
  origin: [
    "http://localhost:5002",        // Document Service (local dev)
    "http://document-service:5002", // Document Service (Docker)
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use("/notifications", notificationRoutes);

// Health check includes live DB connection status
app.get("/health", (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  res.status(isDbConnected ? 200 : 503).json({
    status: "Notification Service Running",
    port: process.env.PORT,
    database: isDbConnected ? "connected" : "disconnected",
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Notification Service Error:", err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// Async start — guarantees MongoDB is connected before accepting requests
// Prevents race conditions on slow Atlas connections
const start = async () => {
  validateEnv(["PORT", "MONGO_URI"]);
  await connectDB();

  app.listen(process.env.PORT, () => {
    console.log(`Notification Service running on port ${process.env.PORT}`);
  });
};

if (require.main === module) {
  start().catch((err) => {
    console.error("Failed to start Notification Service:", err.message);
    process.exit(1);
  });
}

module.exports = { app, start };
