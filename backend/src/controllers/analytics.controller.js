const AnalyticsEvent = require('../models/AnalyticsEvent');
const asyncHandler = require('../utils/asyncHandler');

exports.createEvent = asyncHandler(async (req, res) => {
  const { sessionId, eventType, area, hotspotId, durationMs, metadata } = req.body;
  const event = await AnalyticsEvent.create({
    sessionId, eventType, area, hotspotId, durationMs, metadata,
  });
  res.status(201).json({ success: true, id: event._id });
});
