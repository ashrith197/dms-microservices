require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./db");
const validateEnv = require("./src/config/validateEnv");
const organisationRoutes = require("./src/routes/organisationRoutes");
const teamRoutes = require("./src/routes/teamRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/organisations", organisationRoutes);
app.use("/teams", teamRoutes);

app.get("/health", async (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(isDbConnected ? 200 : 503).json({
    status: "User Management Service Running",
    port: process.env.PORT,
    database: isDbConnected ? "connected" : "disconnected",
    note: "Reads and writes auth_db — same database as Auth Service",
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("User Management Service Error:", err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

const start = async () => {
  validateEnv(["PORT", "MONGO_URI"]);
  await connectDB();
  app.listen(process.env.PORT, () => {
    console.log(`User Management Service running on port ${process.env.PORT}`);
    console.log(`Connected to: auth_db (shared with Auth Service)`);
  });
};

if (require.main === module) {
  start().catch((err) => {
    console.error("Failed to start User Management Service:", err.message);
    process.exit(1);
  });
}

module.exports = { app, start };
