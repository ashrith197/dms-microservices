require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");
const setupRoutes = require("./src/routes/proxy");
const validateEnv = require("./src/config/validateEnv");

const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    })
  );

  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({
      status: "API Gateway Running",
      port: process.env.PORT,
      services: {
        auth: process.env.AUTH_SERVICE_URL,
        document: process.env.DOCUMENT_SERVICE_URL,
        search: process.env.SEARCH_SERVICE_URL,
        notification: process.env.NOTIFICATION_SERVICE_URL,
        userManagement: process.env.USER_MANAGEMENT_SERVICE_URL,
        logging: process.env.LOGGING_SERVICE_URL,
      },
    });
  });

  setupRoutes(app);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Route ${req.method} ${req.path} not found`,
    });
  });

  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON body",
      });
    }

    console.error("Gateway Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal gateway error",
    });
  });

  return app;
};

const start = () => {
  validateEnv([
    "PORT",
    "AUTH_SERVICE_URL",
    "DOCUMENT_SERVICE_URL",
    "SEARCH_SERVICE_URL",
    "INTERNAL_SERVICE_KEY",
    "USER_MANAGEMENT_SERVICE_URL",
    "LOGGING_SERVICE_URL",
  ]);

  const app = createApp();

  app.listen(process.env.PORT, () => {
    console.log(`API Gateway running on port ${process.env.PORT}`);
    console.log(`-> Auth Service:            ${process.env.AUTH_SERVICE_URL}`);
    console.log(`-> Document Service:        ${process.env.DOCUMENT_SERVICE_URL}`);
    console.log(`-> Search Service:          ${process.env.SEARCH_SERVICE_URL}`);
    console.log(
      `-> Notification Service:    ${process.env.NOTIFICATION_SERVICE_URL}`
    );
    console.log(
      `-> User Management Service: ${process.env.USER_MANAGEMENT_SERVICE_URL}`
    );
    console.log(`-> Logging Service:         ${process.env.LOGGING_SERVICE_URL}`);
  });
};

if (require.main === module) {
  try {
    start();
  } catch (err) {
    console.error("Failed to start API Gateway:", err.message);
    process.exit(1);
  }
}

module.exports = { createApp, start };
