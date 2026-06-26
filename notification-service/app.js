require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const mongoose  = require("mongoose");
const connectDB = require("./db");
const validateEnv      = require("./src/config/validateEnv");
const { startConsumer }   = require("./src/services/queueService");
const { verifyConnection } = require("./src/services/emailService");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", async (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const isSmtpAlive   = await verifyConnection();

  res.status(isDbConnected && isSmtpAlive ? 200 : 503).json({
    status:   "Notification Service Running",
    port:     process.env.PORT,
    database: isDbConnected ? "connected" : "disconnected",
    smtp:     isSmtpAlive   ? "connected" : "disconnected",
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Notification Service Error:", err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

const start = async () => {
  validateEnv([
    "PORT", "MONGO_URI", "RABBITMQ_URL",
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM",
  ]);
  await connectDB();
  await startConsumer();

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
