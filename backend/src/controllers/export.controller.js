const asyncHandler = require('../utils/asyncHandler');
const Lead = require('../models/Lead');
const AnalyticsEvent = require('../models/AnalyticsEvent');

/**
 * GET /api/export/leads
 * Exports student leads in CSV format (Admin only).
 */
exports.exportLeadsCsv = asyncHandler(async (req, res) => {
  const leads = await Lead.find().sort({ createdAt: -1 });

  // TODO: Format leads as CSV content or use a streaming CSV serializer
  const csvHeaders = 'id,email,hotspotId,sessionId,createdAt\n';
  const csvRows = leads
    .map((l) => `"${l._id}","${l.email}","${l.hotspotId || ''}","${l.sessionId || ''}","${l.createdAt.toISOString()}"`)
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="leads_export.csv"');
  res.status(200).send(csvHeaders + csvRows);
});

/**
 * GET /api/export/analytics
 * Exports VR telemetry events in CSV format (Admin only).
 */
exports.exportAnalyticsCsv = asyncHandler(async (req, res) => {
  const events = await AnalyticsEvent.find().sort({ createdAt: -1 }).limit(5000);

  // TODO: Format analytics as CSV content
  const csvHeaders = 'id,sessionId,eventType,area,hotspotId,durationMs,createdAt\n';
  const csvRows = events
    .map((e) => `"${e._id}","${e.sessionId}","${e.eventType}","${e.area || ''}","${e.hotspotId || ''}","${e.durationMs || 0}","${e.createdAt.toISOString()}"`)
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="analytics_export.csv"');
  res.status(200).send(csvHeaders + csvRows);
});
