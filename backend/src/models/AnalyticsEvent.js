const mongoose = require('mongoose');

const EVENT_TYPES = [
  'session_start',
  'session_end',
  'area_enter',
  'area_exit',
  'hotspot_view',
  'info_request',
];

// Anonymous engagement telemetry. sessionId comes from Firebase anonymous auth;
// no PII stored here.
const analyticsEventSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, trim: true, index: true },
    eventType: { type: String, required: true, enum: EVENT_TYPES },
    area: { type: String, trim: true },
    hotspotId: { type: String, trim: true },
    durationMs: { type: Number, min: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

analyticsEventSchema.index({ eventType: 1, createdAt: -1 });

const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);
AnalyticsEvent.EVENT_TYPES = EVENT_TYPES;
module.exports = AnalyticsEvent;
