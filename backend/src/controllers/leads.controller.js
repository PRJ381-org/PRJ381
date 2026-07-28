const Lead = require('../models/Lead');
const asyncHandler = require('../utils/asyncHandler');

exports.createLead = asyncHandler(async (req, res) => {
  const { email, hotspotId, sessionId } = req.body;
  const lead = await Lead.create({ email, hotspotId, sessionId });
  res.status(201).json({ success: true, id: lead._id });
});
