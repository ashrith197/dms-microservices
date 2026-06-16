// requireRole(["admin"]) or requireRole(["manager", "admin"])
// Must be used AFTER protect middleware — relies on x-user-role being set
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const role = req.headers["x-user-role"];

    if (!role) {
      return res.status(401).json({
        success: false,
        message: "No role found — request must pass through authentication first",
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied — requires one of: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
};

module.exports = { requireRole };
