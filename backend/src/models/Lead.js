const mongoose = require('mongoose');

// Lead = a "Request More Information" submission. Stores PII (email), so keep
// it minimal and treat per POPIA. Only created when the user opts in.
const leadSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    hotspotId: { type: String, trim: true },
    sessionId: { type: String, trim: true, index: true },
    processed: { type: Boolean, default: false }, // admissions workflow flag
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lead', leadSchema);
