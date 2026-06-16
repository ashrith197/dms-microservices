const extractUserHeaders = (req) => {
  const userId         = req.headers["x-user-id"];
  const userEmail      = req.headers["x-user-email"];
  const userRole       = req.headers["x-user-role"];
  const userName       = req.headers["x-user-name"];
  const organisationId = req.headers["x-organisation-id"];

  if (!userId || !userRole) return null;

  return { userId, userEmail, userRole, userName, organisationId: organisationId || null };
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const user = extractUserHeaders(req);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Missing gateway headers. Request must come through API Gateway.",
      });
    }

    if (!allowedRoles.includes(user.userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied — requires one of: ${allowedRoles.join(", ")}`,
      });
    }

    req.gatewayUser = user;
    next();
  };
};

module.exports = { extractUserHeaders, requireRole };
