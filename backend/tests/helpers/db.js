/**
 * Per-worker connection to the shared in-memory MongoDB started in globalSetup.
 *
 * `describeDb` is `describe` when a database is available and `describe.skip`
 * when it is not, so DB-backed suites appear in the output as explicitly skipped
 * rather than silently absent.
 */
const mongoose = require('mongoose');

const uri = process.env.TEST_MONGO_URI;
const hasDb = Boolean(uri);

const describeDb = hasDb ? describe : describe.skip;

async function connect() {
  if (!hasDb) return;
  // A distinct dbName per worker keeps parallel suites from clearing each
  // other's collections mid-assertion.
  await mongoose.connect(uri, { dbName: `prj381_test_${process.pid}` });
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

async function clear() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

module.exports = { describeDb, hasDb, connect, disconnect, clear };
