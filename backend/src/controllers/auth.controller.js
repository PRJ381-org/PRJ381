const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');

/**
 * POST /api/auth/login
 * Handles user login and returns JWT session token with role information.
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // TODO: Validate credentials against User model using bcrypt
  // TODO: Generate JWT containing { id, email, role }

  res.json({
    success: true,
    message: 'Auth login endpoint scaffold ready',
    token: 'placeholder-jwt-token',
    user: {
      email: email || 'user@campus.ac.za',
      role: 'admin',
    },
  });
});

/**
 * GET /api/auth/me
 * Returns information for currently authenticated user.
 */
exports.me = asyncHandler(async (req, res) => {
  // TODO: Return authenticated user info from req.user
  res.json({
    success: true,
    user: req.user || { email: 'viewer@campus.ac.za', role: 'viewer' },
  });
});
