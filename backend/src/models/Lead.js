const mongoose = require('mongoose');

// A lead raised from the end-of-tour screen rather than from a specific
// exhibit. This is the fallback, so it is also what pre-`source` rows migrate to.
const DEFAULT_LEAD_SOURCE = 'end_screen';

// The shipped Unreal client (CampusBackendClient.cpp) posts `hotspotId` and knows
// nothing about `source`. Rather than force a client rebuild before the freeze,
// the server derives `source` from whatever it is given. Hotspot-sourced leads
// become "hotspot:<id>" - namespaced so adding an exhibit never needs a schema
// or enum change, and so admissions can still tell the two origins apart.
// Exported as a static because src/scripts/migrate-leads.js must apply exactly
// this rule to historical rows; two copies of it would drift.
function deriveSource({ source, hotspotId } = {}) {
  const explicit = typeof source === 'string' ? source.trim() : '';
  if (explicit) return explicit;

  const hotspot = typeof hotspotId === 'string' ? hotspotId.trim() : '';
  if (hotspot) return `hotspot:${hotspot}`;

  return DEFAULT_LEAD_SOURCE;
}

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
    // Retained alongside `source` even though it is now redundant: the shipped
    // client still sends it, and discarding a field we are already receiving
    // would lose data we cannot re-collect after the open day.
    hotspotId: { type: String, trim: true },
    // Intentionally NOT indexed. Mongoose builds declared indexes at startup by
    // default, so adding one here would trigger an unannounced index build on
    // the production cluster the next time the app boots. Every index change is
    // gated behind src/scripts/enable-indexes.js instead.
    source: { type: String, trim: true, default: DEFAULT_LEAD_SOURCE },
    sessionId: { type: String, trim: true, index: true },
    processed: { type: Boolean, default: false }, // admissions workflow flag
  },
  { timestamps: true }
);

const Lead = mongoose.model('Lead', leadSchema);
Lead.deriveSource = deriveSource;
Lead.DEFAULT_LEAD_SOURCE = DEFAULT_LEAD_SOURCE;
module.exports = Lead;
