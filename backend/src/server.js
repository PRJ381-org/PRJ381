const app = require('./app');
const { startDb } = require('./db');
const { PORT } = require('./config/env');

/**
 * Starts listening FIRST, then connects to MongoDB in the background.
 *
 * The order is the point. See src/db.js startDb() for why: a database that is
 * unreachable at boot must degrade to /health reporting db:"disconnected", not
 * to a process that never listens.
 *
 * Lives here rather than in index.js so it can be imported by tests without
 * starting anything. index.js stays a bare bootstrap, because it is the file
 * Passenger is configured to load and it must behave identically however
 * Passenger chooses to load it.
 *
 * Resolves once the socket is accepting connections.
 */
function startServer({ port = PORT, db: dbOptions = {} } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const address = server.address();
      const boundPort = typeof address === 'object' && address ? address.port : port;
      console.log(`PRJ381 backend listening on :${boundPort}`);

      // Started only after the socket is up, so a slow or failing connection
      // cannot delay the moment the app becomes reachable.
      const db = startDb(dbOptions);

      resolve({
        server,
        db,
        async stop() {
          await db.stop();
          await new Promise((done) => server.close(done));
        },
      });
    });

    // A port already in use is a real startup failure and should surface as one.
    server.once('error', reject);
  });
}

module.exports = { startServer };
