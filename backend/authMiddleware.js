const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  // Check whether the authorization header exists.
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is required. Please log in.",
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is missing.",
    });
  }

  const secret = process.env.JWT_SECRET;

  // Never authenticate requests without a configured secret.
  if (!secret) {
    console.error("JWT_SECRET is not configured.");

    return res.status(500).json({
      success: false,
      message: "Authentication is not configured on the server.",
    });
  }

  try {
    const decoded = jwt.verify(token, secret);

    // Make the authenticated user's information available to routes.
    req.user = decoded;

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please log in again.",
      });
    }

    return res.status(403).json({
      success: false,
      message: "Invalid authentication token. Please log in again.",
    });
  }
}

module.exports = authenticateToken;