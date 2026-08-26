const AnalyticsEvent = require('../models/AnalyticsEvent');
const asyncHandler = require('../utils/asyncHandler');

// Chosen to keep a single request under the 100kb express.json limit with room
// to spare: 200 events of realistic size land around 30-40kb.
const MAX_BATCH_EVENTS = 200;

// Copy only fields we model. Callers are untrusted, and `metadata` being Mixed
// makes it tempting to spread the whole object straight through.
function toEventDoc(e = {}) {
  return {
    sessionId: e.sessionId,
    eventType: e.eventType,
    area: e.area,
    hotspotId: e.hotspotId,
    durationMs: e.durationMs,
    seq: e.seq,
    platform: e.platform,
    buildId: e.buildId,
    appVersion: e.appVersion,
    metadata: e.metadata,
  };
}

exports.createEvent = asyncHandler(async (req, res) => {
  const event = await AnalyticsEvent.create(toEventDoc(req.body));
  res.status(201).json({ success: true, id: event._id });
});

// POST /api/analytics/batch -> flush a queue of events in one request.
//
// Exists for the headset's offline buffer: a client that loses Wi-Fi mid-tour
// accumulates events and drains them on reconnect, and doing that one HTTP
// request at a time is both slow and likely to trip the rate limiter.
//
// The contract is deliberately forgiving. A client that times out waiting for
// our response cannot know whether the write landed, so its only safe move is
// to resend - which means we WILL see the same events twice. Duplicates are
// therefore counted, not failed, and the batch is unordered so one bad event
// cannot discard the good ones behind it. Net effect: retrying a batch is
// idempotent (once the unique {sessionId, seq} index from Phase 5 is enabled),
// and no client ever needs retry logic more complex than "send it again".
exports.createEventsBatch = asyncHandler(async (req, res) => {
  const docs = req.body.events.map(toEventDoc);

  let inserted = 0;
  let duplicates = 0;

  try {
    const created = await AnalyticsEvent.insertMany(docs, { ordered: false });
    inserted = created.length;
  } catch (err) {
    // Partial failure: Mongoose throws MongoBulkWriteError but still attaches
    // the docs that did land. An empty writeErrors means this was not a partial
    // failure at all (connection lost, etc.), which must surface as a 500.
    const writeErrors = err.writeErrors || err.result?.writeErrors || [];
    if (!writeErrors.length) throw err;

    inserted = Array.isArray(err.insertedDocs) ? err.insertedDocs.length : 0;
    duplicates = writeErrors.filter((we) => (we.code ?? we.err?.code) === 11000).length;
  }

  // Derived as the remainder rather than counted directly, because an unordered
  // insertMany drops schema-invalid documents WITHOUT throwing - they appear in
  // neither the result array nor any error. Reconciling against the input length
  // is the only way to notice that, and it keeps the reported numbers honest if
  // the driver ever grows another silent-drop path.
  const failed = docs.length - inserted - duplicates;

  if (failed > 0) {
    console.warn(
      `analytics batch: ${failed}/${docs.length} events rejected (inserted ${inserted}, duplicates ${duplicates})`
    );
  }

  // Always 201 on a well-formed request, even with some rejects. A rejected
  // event is rejected deterministically, so signalling failure would only make
  // the client resend the batch forever and re-duplicate the accepted ones.
  res.status(201).json({
    success: true,
    received: docs.length,
    inserted,
    duplicates,
    failed,
  });
});

exports.MAX_BATCH_EVENTS = MAX_BATCH_EVENTS;

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
