require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");
const setupRoutes = require("./src/routes/proxy");

const app = express();
const port = process.env.PORT || 5000;

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
    port,
    services: {
      auth: process.env.AUTH_SERVICE_URL,
      document: process.env.DOCUMENT_SERVICE_URL,
      search: process.env.SEARCH_SERVICE_URL,
      notification: process.env.NOTIFICATION_SERVICE_URL,
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
  res.status(500).json({
    success: false,
    message: "Internal gateway error",
  });
});

app.listen(port, () => {
  console.log(`API Gateway running on port ${port}`);
  console.log(`-> Auth Service:         ${process.env.AUTH_SERVICE_URL}`);
  console.log(`-> Document Service:     ${process.env.DOCUMENT_SERVICE_URL}`);
  console.log(`-> Search Service:       ${process.env.SEARCH_SERVICE_URL}`);
  console.log(`-> Notification Service: ${process.env.NOTIFICATION_SERVICE_URL}`);
});
