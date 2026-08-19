const Lead = require('../models/Lead');
const asyncHandler = require('../utils/asyncHandler');

exports.createLead = asyncHandler(async (req, res) => {
  const { email, hotspotId, sessionId } = req.body;
  const lead = await Lead.create({ email, hotspotId, sessionId });
  res.status(201).json({ success: true, id: lead._id });
});

// GET /api/leads -> all leads, for Power BI / dashboard consumption
exports.listLeads = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  const leads = await Lead.find().sort({ createdAt: -1 }).limit(limit);
  res.json({ success: true, count: leads.length, leads });
});
