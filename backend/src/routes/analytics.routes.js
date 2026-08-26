const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../utils/validate');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const {
  createEvent,
  createEventsBatch,
  listEvents,
  getSummary,
  MAX_BATCH_EVENTS,
} = require('../controllers/analytics.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const requireDb = require('../middlewares/requireDb');

const router = express.Router();

// Mitigate backend flooding / analytics noise (M1 cooldown strategy).
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// Batch carries up to MAX_BATCH_EVENTS events per request, so it needs a far
// lower request ceiling than the single-event route to cap the same amount of
// write volume. 20/min still lets a headset drain 4000 buffered events a
// minute, which is far more than a tour can generate.
const analyticsBatchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
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
    body('platform').optional().isString().trim(),
    body('buildId').optional().isString().trim(),
    body('appVersion').optional().isString().trim(),
    body('metadata').optional().isObject(),
  ],
  validate,
  requireDb,
  createEvent
);

// POST /api/analytics/batch -> flush a queue of buffered events in one request.
// Unauthenticated for the same reason as /events: the Unreal client has no user
// to log in as, and requiring a credential would mean shipping one inside the
// headset build.
router.post(
  '/batch',
  analyticsBatchLimiter,
  [
    body('events')
      .isArray({ min: 1, max: MAX_BATCH_EVENTS })
      .withMessage(`events must be an array of 1-${MAX_BATCH_EVENTS} items`),
    body('events.*.sessionId').isString().trim().notEmpty(),
    body('events.*.eventType').isIn(AnalyticsEvent.EVENT_TYPES),
    body('events.*.area').optional().isString().trim(),
    body('events.*.hotspotId').optional().isString().trim(),
    body('events.*.durationMs').optional().isInt({ min: 0 }),
    body('events.*.seq').optional().isInt({ min: 0 }),
    body('events.*.platform').optional().isString().trim(),
    body('events.*.buildId').optional().isString().trim(),
    body('events.*.appVersion').optional().isString().trim(),
    body('events.*.metadata').optional().isObject(),
  ],
  validate,
  // A 503 here is safe for the client: the headset keeps its buffer and resends
  // it, and the unique {sessionId, seq} index makes that resend idempotent.
  requireDb,
  createEventsBatch
);

// GET /api/analytics/events -> raw events (Power BI / dashboard) - requires login
router.get('/events', requireAuth, requireDb, listEvents);

// GET /api/analytics/summary -> aggregate counts (dashboard) - requires login
router.get('/summary', requireAuth, requireDb, getSummary);

module.exports = router;
