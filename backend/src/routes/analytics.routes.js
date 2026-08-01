const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../utils/validate');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const { createEvent } = require('../controllers/analytics.controller');

const router = express.Router();

// Mitigate backend flooding / analytics noise (M1 cooldown strategy).
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/analytics/events -> record one engagement event
router.post(
  '/events',
  analyticsLimiter,
  [
    body('sessionId').isString().trim().notEmpty(),
    body('eventType').isIn(AnalyticsEvent.EVENT_TYPES),
    body('area').optional().isString().trim(),
    body('hotspotId').optional().isString().trim(),
    body('durationMs').optional().isInt({ min: 0 }),
    body('seq').optional().isInt({ min: 0 }),
    body('metadata').optional().isObject(),
  ],
  validate,
  createEvent
);

module.exports = router;
