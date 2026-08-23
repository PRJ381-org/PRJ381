/**
 * Authentication and Role-Based Access Control (RBAC) Middleware.
 */
const { verifySessionToken } = require('../utils/jwt');

// Middleware to verify JWT token from Authorization: Bearer <token> or ?token= query param
// (the query param path exists for CSV export links, which can't set custom headers)
exports.requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = headerToken || req.query.token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required' });
  }

  try {
    req.user = verifySessionToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Middleware to restrict routes to specific roles (e.g. ['admin'])
exports.requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    next();
  };
};
