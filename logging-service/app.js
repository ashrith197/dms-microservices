require("dotenv").config();

const express    = require("express");
const cors       = require("cors");
const mongoose   = require("mongoose");
const connectDB  = require("./db");
const validateEnv   = require("./src/config/validateEnv");
const { startConsumer } = require("./src/services/queueService");
const logRoutes  = require("./src/routes/logRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/logs", logRoutes);

app.get("/health", async (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  res.status(isDbConnected ? 200 : 503).json({
    status: "Logging Service Running",
    port: process.env.PORT,
    database: isDbConnected ? "connected" : "disconnected",
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Logging Service Error:", err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

const start = async () => {
  validateEnv(["PORT", "MONGO_URI", "RABBITMQ_URL"]);
  await connectDB();
  await startConsumer();

  app.listen(process.env.PORT, () => {
    console.log(`Logging Service running on port ${process.env.PORT}`);
  });
};

if (require.main === module) {
  start().catch((err) => {
    console.error("Failed to start Logging Service:", err.message);
    process.exit(1);
  });
}

module.exports = { app, start };
