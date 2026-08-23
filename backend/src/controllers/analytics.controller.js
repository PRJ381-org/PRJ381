const AnalyticsEvent = require('../models/AnalyticsEvent');
const asyncHandler = require('../utils/asyncHandler');

exports.createEvent = asyncHandler(async (req, res) => {
  const { sessionId, eventType, area, hotspotId, durationMs, seq, metadata } = req.body;
  const event = await AnalyticsEvent.create({
    sessionId, eventType, area, hotspotId, durationMs, seq, metadata,
  });
  res.status(201).json({ success: true, id: event._id });
});

// GET /api/analytics/events -> raw events, for Power BI / dashboard consumption
exports.listEvents = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 5000);
  const events = await AnalyticsEvent.find().sort({ createdAt: -1 }).limit(limit);
  res.json({ success: true, count: events.length, events });
});

// GET /api/analytics/summary -> aggregate counts for the dashboard
exports.getSummary = asyncHandler(async (req, res) => {
  const [byType, totalEvents, sessionIds, byArea, topHotspots, durationStats] = await Promise.all([
    AnalyticsEvent.aggregate([{ $group: { _id: '$eventType', count: { $sum: 1 } } }]),
    AnalyticsEvent.countDocuments(),
    AnalyticsEvent.distinct('sessionId'),
    AnalyticsEvent.aggregate([
      { $match: { area: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$area', totalDurationMs: { $sum: '$durationMs' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { hotspotId: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$hotspotId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { durationMs: { $gt: 0 } } },
      { $group: { _id: '$sessionId', totalSessionDurationMs: { $sum: '$durationMs' } } },
      { $group: { _id: null, avgDurationMs: { $avg: '$totalSessionDurationMs' } } },
    ]),
  ]);

  const eventsByType = Object.fromEntries(byType.map((e) => [e._id, e.count]));
  const areas = Object.fromEntries(
    byArea.map((a) => [a._id, Math.round((a.totalDurationMs || 0) / 1000) || a.count])
  );
  const hotspots = Object.fromEntries(topHotspots.map((h) => [h._id, h.count]));
  const avgSessionDurationMs = Math.round(durationStats[0]?.avgDurationMs || 0);

  res.json({
    success: true,
    totalEvents,
    uniqueSessions: sessionIds.length,
    avgSessionDurationMs,
    eventsByType,
    areas,
    hotspots,
  });
});
