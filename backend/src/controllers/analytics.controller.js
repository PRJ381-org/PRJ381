const AnalyticsEvent = require('../models/AnalyticsEvent');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Helper to build MongoDB date filter from timeframe query parameter.
 */
function getDateFilter(timeframe) {
  if (!timeframe || timeframe === 'all') return null;

  if (timeframe === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { createdAt: { $gte: start } };
  }
  if (timeframe === '24h') {
    return { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } };
  }
  if (timeframe === '7d') {
    return { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } };
  }
  if (timeframe === '30d') {
    return { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } };
  }
  return null;
}

exports.createEvent = asyncHandler(async (req, res) => {
  const { sessionId, eventType, area, hotspotId, durationMs, seq, metadata } = req.body;
  const event = await AnalyticsEvent.create({
    sessionId, eventType, area, hotspotId, durationMs, seq, metadata,
  });
  res.status(201).json({ success: true, id: event._id });
});

// GET /api/analytics/events -> raw events, for Power BI / dashboard consumption
exports.listEvents = asyncHandler(async (req, res) => {
  const { timeframe = 'all' } = req.query;
  const dateFilter = getDateFilter(timeframe);
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 5000);

  const query = dateFilter || {};
  const events = await AnalyticsEvent.find(query).sort({ createdAt: -1 }).limit(limit);
  res.json({ success: true, timeframe, count: events.length, events });
});

// GET /api/analytics/summary -> aggregate counts for the dashboard with timeframe filtering
exports.getSummary = asyncHandler(async (req, res) => {
  const { timeframe = 'all' } = req.query;
  const dateFilter = getDateFilter(timeframe);
  const matchStage = dateFilter ? [{ $match: dateFilter }] : [];

  const [byType, totalEvents, sessionIds, byArea, topHotspots, durationStats] = await Promise.all([
    AnalyticsEvent.aggregate([
      ...matchStage,
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ]),
    dateFilter ? AnalyticsEvent.countDocuments(dateFilter) : AnalyticsEvent.countDocuments(),
    dateFilter ? AnalyticsEvent.distinct('sessionId', dateFilter) : AnalyticsEvent.distinct('sessionId'),
    AnalyticsEvent.aggregate([
      ...matchStage,
      { $match: { area: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$area', totalDurationMs: { $sum: '$durationMs' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    AnalyticsEvent.aggregate([
      ...matchStage,
      { $match: { hotspotId: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$hotspotId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    AnalyticsEvent.aggregate([
      ...matchStage,
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
    timeframe,
    totalEvents,
    uniqueSessions: sessionIds.length,
    avgSessionDurationMs,
    eventsByType,
    areas,
    hotspots,
  });
});
