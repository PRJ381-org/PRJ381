/**
 * Starts one in-memory MongoDB for the whole run (jest `globalSetup`).
 *
 * This has to happen before Jest collects tests, not in a beforeAll: describe()
 * blocks are registered up front, so a suite can only decide to skip itself if
 * it can read availability synchronously at import time. globalSetup writes the
 * URI into process.env, which Jest propagates to worker processes.
 *
 * If no mongod can be started - no cached binary, no network, locked-down CI -
 * the run continues without a database and the DB-backed suites skip LOUDLY.
 * See globalTeardown.js for the banner.
 */
module.exports = async () => {
  try {
    // Escape hatch for running only the DB-free tests, and the means of
    // verifying that the skip path itself still shouts. Safe to expose because
    // taking it produces the same loud banner as a genuine failure.
    if (process.env.TEST_NO_DB === '1') {
      throw new Error('TEST_NO_DB=1 was set, so no database was started');
    }

    // eslint-disable-next-line global-require
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const server = await MongoMemoryServer.create();
    process.env.TEST_MONGO_URI = server.getUri();
    globalThis.__MONGOD__ = server;
  } catch (err) {
    delete process.env.TEST_MONGO_URI;
    process.env.TEST_MONGO_SKIP_REASON = err.message;
  }
};
