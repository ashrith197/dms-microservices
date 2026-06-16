const {
  createProxyMiddleware,
  fixRequestBody,
} = require("http-proxy-middleware");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const serviceTarget = (baseUrl) => {
  if (!baseUrl) {
    throw new Error("Missing target URL");
  }

  return baseUrl.replace(/\/$/, "");
};

const rewriteWithBasePath = (basePath) => (path) => {
  const url = new URL(path, "http://gateway.local");
  const pathname = url.pathname === "/" ? basePath : `${basePath}${url.pathname}`;

  return `${pathname}${url.search}`;
};

const sendProxyError = (serviceName) => (err, req, res) => {
  if (res.headersSent) {
    return;
  }

  res.writeHead(503, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      success: false,
      message: `${serviceName} service unavailable`,
    })
  );
};

const proxyTo = (serviceName, baseUrl, basePath) =>
  createProxyMiddleware({
    target: serviceTarget(baseUrl),
    changeOrigin: true,
    pathRewrite: rewriteWithBasePath(basePath),
    on: {
      proxyReq: fixRequestBody,
      error: sendProxyError(serviceName),
    },
  });

const setupRoutes = (app) => {
  // ─────────────────────────────────────────
  // AUTH — Public, no JWT required
  // ─────────────────────────────────────────
  app.use("/auth", proxyTo("Auth", process.env.AUTH_SERVICE_URL, "/auth"));

  // ─────────────────────────────────────────
  // ORGANISATIONS — Admin only
  // ─────────────────────────────────────────
  app.use(
    "/organisations",
    protect,
    requireRole(["admin"]),
    proxyTo("User Management", process.env.USER_MANAGEMENT_SERVICE_URL, "/organisations")
  );

  // ─────────────────────────────────────────
  // TEAMS — Manager and Admin
  // ─────────────────────────────────────────
  app.use(
    "/teams",
    protect,
    requireRole(["manager", "admin"]),
    proxyTo("User Management", process.env.USER_MANAGEMENT_SERVICE_URL, "/teams")
  );

  // ─────────────────────────────────────────
  // DOCUMENTS — All authenticated users
  // ─────────────────────────────────────────
  app.use(
    "/documents",
    protect,
    proxyTo("Document", process.env.DOCUMENT_SERVICE_URL, "/documents")
  );

  // ─────────────────────────────────────────
  // SEARCH — All authenticated users
  // ─────────────────────────────────────────
  app.use(
    "/search",
    protect,
    proxyTo("Search", process.env.SEARCH_SERVICE_URL, "/search")
  );

  // ─────────────────────────────────────────
  // LOGS — Admin only
  // ─────────────────────────────────────────
  app.use(
    "/logs",
    protect,
    requireRole(["admin"]),
    proxyTo("Logging", process.env.LOGGING_SERVICE_URL, "/logs")
  );

  // Notification Service is NOT exposed through Gateway — internal only
};

module.exports = setupRoutes;
