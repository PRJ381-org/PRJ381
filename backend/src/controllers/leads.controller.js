const Lead = require('../models/Lead');
const asyncHandler = require('../utils/asyncHandler');

exports.createLead = asyncHandler(async (req, res) => {
  const { email, hotspotId, sessionId, source } = req.body;
  // Derived server-side so old clients (which only send hotspotId) and any
  // future client that sends `source` directly both land on the same value.
  const lead = await Lead.create({
    email,
    hotspotId,
    sessionId,
    source: Lead.deriveSource({ source, hotspotId }),
  });
  res.status(201).json({ success: true, id: lead._id, source: lead.source });
});

// GET /api/leads -> all leads, for Power BI / dashboard consumption
exports.listLeads = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  const leads = await Lead.find().sort({ createdAt: -1 }).limit(limit);
  res.json({ success: true, count: leads.length, leads });
});
