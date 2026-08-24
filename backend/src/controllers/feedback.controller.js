const asyncHandler = require('../utils/asyncHandler');
const { readFeedbackRows } = require('../utils/googleSheets');

// GET /api/feedback -> Google Form responses (admin only)
exports.listFeedback = asyncHandler(async (req, res) => {
  const feedback = await readFeedbackRows();
  res.json({ success: true, count: feedback.length, feedback });
});
