#!/usr/bin/env node
/**
 * Backfills `source` on leads created before the field existed.
 *
 *   node src/scripts/migrate-leads.js            report only, changes nothing
 *   node src/scripts/migrate-leads.js --apply    write the changes
 *
 * Dry run is the default deliberately: this touches the one collection whose
 * contents cannot be regenerated, and the cost of looking first is a few
 * seconds.
 *
 * Safe to re-run. Only documents with no `source` are considered, and the
 * mapping is the same pure function the API uses (Lead.deriveSource), so a
 * migrated row and a freshly-written row end up identical.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { MONGODB_URI } = require('../config/env');
const Lead = require('../models/Lead');

const APPLY = process.argv.includes('--apply');

function summarise(leads) {
  const counts = new Map();
  for (const lead of leads) {
    const derived = Lead.deriveSource(lead);
    counts.set(derived, (counts.get(derived) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

async function main() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not set.');

  // autoIndex:false so a data migration cannot also trigger an index build as a
  // side effect of registering the models. Index changes belong to
  // enable-indexes.js and nowhere else.
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000, autoIndex: false });
  console.log(`Connected to ${mongoose.connection.name}\n`);

  const total = await Lead.countDocuments();
  // `null` covers documents written before the field existed at all.
  const pending = await Lead.find({ $or: [{ source: { $exists: false } }, { source: null }] }).lean();

  console.log(`Leads in collection : ${total}`);
  console.log(`Missing "source"    : ${pending.length}`);

  if (!pending.length) {
    console.log('\nNothing to do - every lead already has a source.');
    return;
  }

  console.log('\nWould set:');
  for (const [source, count] of summarise(pending)) {
    console.log(`  ${String(count).padStart(6)}  ->  ${source}`);
  }

  if (!APPLY) {
    console.log('\nDRY RUN - nothing was written.');
    console.log('Re-run with --apply to make these changes.');
    return;
  }

  console.log('\nApplying...');

  // One bulk write rather than a document-per-round-trip loop; on a shared host
  // the latency of the latter is what turns a 5-second job into a 5-minute one.
  const ops = pending.map((lead) => ({
    updateOne: {
      filter: { _id: lead._id },
      update: { $set: { source: Lead.deriveSource(lead) } },
    },
  }));

  const result = await Lead.bulkWrite(ops, { ordered: false });
  console.log(`Modified ${result.modifiedCount} of ${pending.length} leads.`);

  const remaining = await Lead.countDocuments({
    $or: [{ source: { $exists: false } }, { source: null }],
  });
  if (remaining > 0) {
    console.error(`\nWARNING: ${remaining} leads still have no source. Re-run to retry.`);
    process.exitCode = 1;
  } else {
    console.log('Verified: every lead now has a source.');
  }
}

main()
  .catch((err) => {
    console.error('\nMigration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
