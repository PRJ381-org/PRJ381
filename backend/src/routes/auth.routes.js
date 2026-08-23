const express = require('express');
const { body } = require('express-validator');
const validate = require('../utils/validate');
const { login, microsoftLogin, me, listUsers } = require('../controllers/auth.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

const router = express.Router();

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

// POST /api/auth/microsoft -> exchange a Microsoft Entra ID token for a session JWT
router.post('/microsoft', [body('idToken').notEmpty().withMessage('idToken is required')], validate, microsoftLogin);

// GET /api/auth/me
router.get('/me', requireAuth, me);

// GET /api/auth/users -> list registered users and roles (admin only)
router.get('/users', requireAuth, requireRole(['admin']), listUsers);

module.exports = router;
