const axios = require("axios");

const setUserHeader = (req, headerName, value) => {
  if (value !== undefined && value !== null) {
    req.headers[headerName] = String(value);
  }
};

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, no token provided",
      });
    }

    const response = await axios.get(
      `${process.env.AUTH_SERVICE_URL}/auth/verify-token`,
      {
        headers: {
          Authorization: authHeader,
          "x-internal-service-key": process.env.INTERNAL_SERVICE_KEY,
        },
        timeout: 5000,
      }
    );

    const { user } = response.data;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed",
      });
    }

    req.user = user;

    setUserHeader(req, "x-user-id", user.id);
    setUserHeader(req, "x-user-email", user.email);
    setUserHeader(req, "x-user-role", user.role);
    setUserHeader(req, "x-user-name", user.name);

    next();
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }

    if (
      err.code === "ECONNREFUSED" ||
      err.code === "ETIMEDOUT" ||
      err.code === "ECONNABORTED"
    ) {
      return res.status(503).json({
        success: false,
        message: "Authentication service unavailable",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

module.exports = { protect };
