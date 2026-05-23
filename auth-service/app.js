require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const authRoutes = require("./src/routes/authRoutes");

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

// DB Connection
connectDB();

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

app.listen(process.env.PORT, () => {
  console.log(`Auth Service running on port ${process.env.PORT}`);
});