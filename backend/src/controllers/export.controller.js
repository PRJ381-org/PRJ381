const asyncHandler = require('../utils/asyncHandler');
const Lead = require('../models/Lead');
const AnalyticsEvent = require('../models/AnalyticsEvent');

/**
 * Helper to format date string for filenames (YYYY-MM-DD)
 */
function getDateString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * GET /api/export/leads
 * Exports all prospective student leads in CSV format (Admin only).
 */
exports.exportLeadsCsv = asyncHandler(async (req, res) => {
  const leads = await Lead.find().sort({ createdAt: -1 });

  let csv = `# Belgium Campus - Virtual Open Day Student Leads (Admin Export)\n`;
  csv += `# Generated at: ${new Date().toISOString()}\n`;
  csv += `# Total Records: ${leads.length}\n\n`;
  csv += `Lead ID,Student Email,Session ID,Date & Time (UTC)\n`;

  for (const l of leads) {
    const id = `"${l._id}"`;
    const email = `"${(l.email || '').replace(/"/g, '""')}"`;
    const session = `"${(l.sessionId || 'N/A').replace(/"/g, '""')}"`;
    const date = `"${l.createdAt ? l.createdAt.toISOString() : ''}"`;
    csv += `${id},${email},${session},${date}\n`;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="belgium_campus_leads_${getDateString()}.csv"`
  );
  res.status(200).send(csv);
});

/**
 * GET /api/export/analytics
 * Exports raw VR telemetry events in CSV format for Power BI / Excel (Admin only).
 */
exports.exportAnalyticsCsv = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10000, 25000);
  const events = await AnalyticsEvent.find().sort({ createdAt: -1 }).limit(limit);

  let csv = `# Belgium Campus - Virtual Open Day Telemetry Events (Admin Export)\n`;
  csv += `# Generated at: ${new Date().toISOString()}\n`;
  csv += `# Sample Size: ${events.length} records\n\n`;
  csv += `Event ID,Session ID,Event Type,Campus Area,Hotspot ID,Dwell Duration (ms),Sequence Number,Timestamp (UTC)\n`;

  for (const e of events) {
    const id = `"${e._id}"`;
    const session = `"${(e.sessionId || '').replace(/"/g, '""')}"`;
    const type = `"${(e.eventType || '').replace(/"/g, '""')}"`;
    const area = `"${(e.area || '').replace(/"/g, '""')}"`;
    const hotspot = `"${(e.hotspotId || '').replace(/"/g, '""')}"`;
    const duration = e.durationMs || 0;
    const seq = e.seq || 0;
    const date = `"${e.createdAt ? e.createdAt.toISOString() : ''}"`;
    csv += `${id},${session},${type},${area},${hotspot},${duration},${seq},${date}\n`;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="belgium_campus_telemetry_${getDateString()}.csv"`
  );
  res.status(200).send(csv);
});

/**
 * GET /api/export/summary
 * Exports full executive dashboard analytics summary in CSV format (Admin only).
 */
exports.exportSummaryCsv = asyncHandler(async (req, res) => {
  const [totalLeads, totalEvents, sessionIds, byArea, topHotspots, durationStats] =
    await Promise.all([
      Lead.countDocuments(),
      AnalyticsEvent.countDocuments(),
      AnalyticsEvent.distinct('sessionId'),
      AnalyticsEvent.aggregate([
        { $match: { area: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$area', totalDurationMs: { $sum: '$durationMs' }, count: { $sum: 1 } } },
        { $sort: { totalDurationMs: -1 } },
      ]),
      AnalyticsEvent.aggregate([
        { $match: { hotspotId: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$hotspotId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AnalyticsEvent.aggregate([
        { $match: { durationMs: { $gt: 0 } } },
        { $group: { _id: '$sessionId', totalSessionDurationMs: { $sum: '$durationMs' } } },
        { $group: { _id: null, avgDurationMs: { $avg: '$totalSessionDurationMs' } } },
      ]),
    ]);

  const uniqueSessions = sessionIds.length;
  const avgDurationMs = Math.round(durationStats[0]?.avgDurationMs || 0);
  const avgMin = Math.floor(avgDurationMs / 60000);
  const avgSec = Math.round((avgDurationMs % 60000) / 1000);
  const conversionRate =
    uniqueSessions > 0 ? ((totalLeads / uniqueSessions) * 100).toFixed(1) : '0.0';

  let csv = `# Belgium Campus - Virtual Open Day Executive Analytics Report (Admin Export)\n`;
  csv += `# Generated at: ${new Date().toISOString()}\n\n`;

  csv += `[EXECUTIVE KPI METRICS]\n`;
  csv += `Metric,Value,Description\n`;
  csv += `Unique VR Sessions,${uniqueSessions},Distinct visitors who explored the virtual campus\n`;
  csv += `Total Analytics Events,${totalEvents},Total telemetry interactions logged\n`;
  csv += `Total Student Leads,${totalLeads},Prospective students who submitted info\n`;
  csv += `Conversion Rate,${conversionRate}%,Inquiry to visitor ratio\n`;
  csv += `Avg Session Duration,${avgMin}m ${avgSec}s,Average exploration dwell time per visitor\n\n`;

  csv += `[CAMPUS AREA ENGAGEMENT & DWELL TIME]\n`;
  csv += `Campus Area / Level,Total Dwell Time (Seconds),Interaction Count\n`;
  if (byArea.length === 0) {
    csv += `No area data recorded yet,0,0\n`;
  } else {
    for (const a of byArea) {
      const area = `"${a._id.replace(/"/g, '""')}"`;
      const seconds = Math.round((a.totalDurationMs || 0) / 1000);
      csv += `${area},${seconds},${a.count}\n`;
    }
  }
  csv += `\n`;

  csv += `[TOP VISITED HOTSPOTS & KIOSKS]\n`;
  csv += `Hotspot Identifier,Total Views / Interactions\n`;
  if (topHotspots.length === 0) {
    csv += `No hotspot data recorded yet,0\n`;
  } else {
    for (const h of topHotspots) {
      const name = `"${h._id.replace(/"/g, '""')}"`;
      csv += `${name},${h.count}\n`;
    }
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="belgium_campus_executive_summary_${getDateString()}.csv"`
  );
  res.status(200).send(csv);
});
