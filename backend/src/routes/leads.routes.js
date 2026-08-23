const express = require('express');
const { body } = require('express-validator');
const validate = require('../utils/validate');
const { createLead, listLeads } = require('../controllers/leads.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

// POST /api/leads  -> log a "Request More Information" submission
router.post(
  '/',
  [
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('hotspotId').optional().isString().trim(),
    body('sessionId').optional().isString().trim(),
  ],
  validate,
  createLead
);

// GET /api/leads -> list leads (Power BI / dashboard) - requires login
router.get('/', requireAuth, listLeads);

module.exports = router;
