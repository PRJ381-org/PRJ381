#!/usr/bin/env node
/**
 * Creates the Phase 5 indexes. NOT enabled automatically - nothing calls this.
 *
 *   node src/scripts/enable-indexes.js            preflight report, changes nothing
 *   node src/scripts/enable-indexes.js --apply    build the indexes
 *
 * These are deliberately kept out of the Mongoose schemas. Mongoose builds
 * declared indexes on connect, so a `unique: true` in a schema file would build
 * against the production cluster the next time the app restarts - during an open
 * day, with no one watching. Putting them here makes every index change a
 * decision someone takes on purpose.
 *
 * Each index is preflighted against real data first, because a unique index over
 * data that already violates it fails at build time and the failure is easy to
 * miss in a deploy log.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { MONGODB_URI } = require('../config/env');
const Lead = require('../models/Lead');
const AnalyticsEvent = require('../models/AnalyticsEvent');

const APPLY = process.argv.includes('--apply');
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Finds analytics events that would collide under unique {sessionId, seq}. */
async function findDuplicateEvents() {
  return AnalyticsEvent.aggregate([
    { $match: { seq: { $exists: true, $ne: null } } },
    { $group: { _id: { sessionId: '$sessionId', seq: '$seq' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);
}

/** Finds emails appearing on more than one lead. */
async function findDuplicateEmails() {
  return Lead.aggregate([
    { $group: { _id: '$email', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);
}

const INDEXES = [
  {
    name: 'analyticsevents: unique {sessionId, seq}',
    why: 'makes a retried batch idempotent - the client can resend its buffer safely',
    collection: () => AnalyticsEvent.collection,
    keys: { sessionId: 1, seq: 1 },
    options: {
      unique: true,
      // seq is optional. Without this filter every event lacking a seq would
      // count as {sessionId, null} and collide with the others in its session.
      partialFilterExpression: { seq: { $exists: true } },
      name: 'uniq_session_seq',
    },
    preflight: async () => {
      const dupes = await findDuplicateEvents();
      if (!dupes.length) return { ok: true };
      return {
        ok: false,
        detail:
          `${dupes.length}+ (sessionId, seq) pairs already appear more than once, e.g. ` +
          dupes
            .slice(0, 3)
            .map((d) => `${d._id.sessionId}/seq=${d._id.seq} x${d.count}`)
            .join(', '),
      };
    },
  },
  {
    name: 'analyticsevents: TTL 12 months on createdAt',
    why: 'POPIA data minimisation - telemetry expires rather than accumulating forever',
    collection: () => AnalyticsEvent.collection,
    keys: { createdAt: 1 },
    options: { expireAfterSeconds: ONE_YEAR_SECONDS, name: 'ttl_createdAt_12mo' },
    preflight: async () => {
      const cutoff = new Date(Date.now() - ONE_YEAR_SECONDS * 1000);
      const doomed = await AnalyticsEvent.countDocuments({ createdAt: { $lt: cutoff } });
      // Not a blocker, but the operator must know before switching this on.
      return doomed > 0
        ? { ok: true, warn: `${doomed} existing events are older than 12 months and will be deleted` }
        : { ok: true };
    },
  },
  {
    name: 'leads: unique email',
    why: 'one prospective student = one lead, however many times they submit',
    collection: () => Lead.collection,
    keys: { email: 1 },
    options: { unique: true, name: 'uniq_email' },
    preflight: async () => {
      const dupes = await findDuplicateEmails();
      if (!dupes.length) return { ok: true };
      return {
        ok: false,
        detail:
          `${dupes.length}+ emails appear on multiple leads, e.g. ` +
          dupes.slice(0, 3).map((d) => `${d._id} x${d.count}`).join(', ') +
          '. De-duplicate before enabling this index.',
      };
    },
  },
];

// Deliberately absent: any TTL on `leads`. Leads are the admissions record and
// must not silently expire.

async function main() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not set.');

  // autoIndex:false matters more here than anywhere else. Mongoose otherwise
  // builds every schema-declared index the moment a model is registered, which
  // would mean a "dry run" quietly creating indexes on the production cluster.
  // This script must only ever create the indexes it explicitly names below.
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000, autoIndex: false });
  console.log(`Connected to ${mongoose.connection.name}`);
  console.log(APPLY ? 'Mode: APPLY\n' : 'Mode: DRY RUN (nothing will be changed)\n');

  let blocked = 0;
  let built = 0;
  let failed = 0;

  for (const index of INDEXES) {
    console.log(`- ${index.name}`);
    console.log(`    purpose: ${index.why}`);

    const check = await index.preflight();
    if (check.warn) console.log(`    NOTE: ${check.warn}`);

    if (!check.ok) {
      console.log(`    BLOCKED: ${check.detail}`);
      blocked += 1;
      continue;
    }

    if (!APPLY) {
      console.log('    preflight OK - would create');
      continue;
    }

    try {
      await index.collection().createIndex(index.keys, index.options);
      console.log('    created');
      built += 1;
    } catch (err) {
      // Loud on purpose. A failed index build otherwise leaves the app running
      // and apparently fine, with the guarantee it was meant to provide absent.
      console.error(`\n${'!'.repeat(72)}`);
      console.error(`INDEX BUILD FAILED: ${index.name}`);
      console.error(`  ${err.message}`);
      console.error('  The application will keep running WITHOUT this index.');
      console.error(`${'!'.repeat(72)}\n`);
      failed += 1;
    }
  }

  console.log('\nSummary');
  console.log(`  blocked by existing data : ${blocked}`);
  if (APPLY) {
    console.log(`  created                  : ${built}`);
    console.log(`  failed                   : ${failed}`);
  } else {
    console.log(`  would create             : ${INDEXES.length - blocked}`);
    console.log('\nDRY RUN - nothing was changed. Re-run with --apply to build them.');
  }

  if (failed > 0 || blocked > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('\nenable-indexes failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
