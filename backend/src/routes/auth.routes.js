const express = require('express');
const { body } = require('express-validator');
const validate = require('../utils/validate');
const { login, me } = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

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

// GET /api/auth/me
router.get('/me', requireAuth, me);

// GET /api/auth/users -> list registered users and roles
router.get('/users', listUsers);

module.exports = router;
