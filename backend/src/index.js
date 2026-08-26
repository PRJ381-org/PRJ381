/**
 * Passenger's configured startup file. Keep it a bare bootstrap - the logic
 * lives in src/server.js so it can be tested without starting a server.
 */
require('dotenv').config();
const { startServer } = require('./server');

// Only a failure to bind the port reaches here. A database that is unreachable
// is deliberately NOT fatal: the app listens anyway and retries in the
// background, so /health stays answerable and can say what is actually wrong.
startServer().catch((err) => {
  console.error('Fatal startup error (could not listen):', err);
  process.exit(1);
});
