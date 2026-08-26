const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../utils/validate');
const { createLead, listLeads } = require('../controllers/leads.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const requireDb = require('../middlewares/requireDb');

const router = express.Router();

// Deliberately loose. Leads are the one thing we cannot re-collect after the
// open day, and every headset in the room shares a single NAT'd IP - so this
// limit is sized against a realistic worst case (a whole cohort finishing their
// tours at once) rather than against a typical user. It still stops a script,
// which would need orders of magnitude more than this to be worth anything.
const leadsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many submissions. Please try again shortly.' },
});

// POST /api/leads  -> log a "Request More Information" submission
router.post(
  '/',
  leadsLimiter,
  [
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('hotspotId').optional().isString().trim(),
    body('source').optional().isString().trim(),
    body('sessionId').optional().isString().trim(),
  ],
  validate,
  // After validate: a malformed submission is still a 400 whatever the database
  // is doing. Only a well-formed request that we cannot store becomes a 503.
  requireDb,
  createLead
);

// GET /api/leads -> list leads (Power BI / dashboard) - requires login
router.get('/', requireAuth, requireDb, listLeads);

module.exports = router;
