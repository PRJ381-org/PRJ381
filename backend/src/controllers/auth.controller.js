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
      email: email || 'admin@belgiumcampus.ac.za',
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
    user: req.user || { email: 'viewer@belgiumcampus.ac.za', role: 'viewer' },
  });
});

/**
 * GET /api/auth/users
 * Returns list of registered dashboard users from MongoDB (excluding password hashes).
 */
exports.listUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}, '-password').sort({ createdAt: -1 });
  res.json({
    success: true,
    count: users.length,
    users,
  });
});
