require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const documentRoutes = require("./src/routes/documentRoutes");
const permissionGroupRoutes = require("./src/routes/permissionGroupRoutes");

const app = express();

app.use(cors());
app.use(express.json());

connectDB();
app.use("/documents/permission-groups", permissionGroupRoutes);
app.use("/documents", documentRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "Document Service Running", port: process.env.PORT });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Document Service Error:", err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(process.env.PORT, () => {
  console.log(`Document Service running on port ${process.env.PORT}`);
});
