const {
  createProxyMiddleware,
  fixRequestBody,
} = require("http-proxy-middleware");
const { protect } = require("../middleware/authMiddleware");

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
  app.use("/auth", proxyTo("Auth", process.env.AUTH_SERVICE_URL, "/auth"));

  app.use(
    "/documents",
    protect,
    proxyTo("Document", process.env.DOCUMENT_SERVICE_URL, "/documents")
  );

  app.use(
    "/search",
    protect,
    proxyTo("Search", process.env.SEARCH_SERVICE_URL, "/search")
  );
};

module.exports = setupRoutes;
