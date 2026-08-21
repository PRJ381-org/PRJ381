/**
 * Authentication and Role-Based Access Control (RBAC) Middleware.
 *
 * Scaffolding for token validation (Viewer / Admin) and role gating.
 */

// Middleware to verify JWT token from Authorization: Bearer <token>
exports.requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication token required' });
  }

  // TODO: Verify JWT token with jsonwebtoken library and attach user payload to req.user
  // const token = authHeader.split(' ')[1];
  // req.user = decodedUser;

  next();
};

// Middleware to restrict routes to specific roles (e.g. ['admin'])
exports.requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    // TODO: Verify req.user exists and its role matches one of allowedRoles
    // if (!req.user || !allowedRoles.includes(req.user.role)) {
    //   return res.status(403).json({ success: false, message: 'Access denied' });
    // }
    next();
  };
};
