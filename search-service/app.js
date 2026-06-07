require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./db");
const validateEnv = require("./src/config/validateEnv");
const searchRoutes = require("./src/routes/searchRoutes");

const app = express();

// Open CORS — Search Service is called by API Gateway, not browser directly
// Gateway handles frontend CORS. This keeps internal communication unrestricted.
app.use(cors());
app.use(express.json());

app.use("/search", searchRoutes);

// Health check — includes live DB status and collection verification
app.get("/health", async (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  let collectionExists = false;
  if (isDbConnected) {
    try {
      const collections = await mongoose.connection.db
        .listCollections({ name: "documents" })
        .toArray();
      collectionExists = collections.length > 0;
    } catch {
      // Ignore — just report as false
    }
  }

  res.status(isDbConnected ? 200 : 503).json({
    status: "Search Service Running",
    port: process.env.PORT,
    database: isDbConnected ? "connected" : "disconnected",
    collection: collectionExists
      ? "documents collection found"
      : "documents collection not found — has Document Service run yet?",
    note: "Reads from document_db — Document Service database",
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Search Service Error:", err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// Async start — MongoDB connected before accepting requests
const start = async () => {
  validateEnv(["PORT", "MONGO_URI"]);
  await connectDB();

  app.listen(process.env.PORT, () => {
    console.log(`Search Service running on port ${process.env.PORT}`);
    console.log(`Reads from: document_db (Document Service database)`);
  });
};

if (require.main === module) {
  start().catch((err) => {
    console.error("Failed to start Search Service:", err.message);
    process.exit(1);
  });
}

module.exports = { app, start };
