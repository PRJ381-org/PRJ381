const mongoose = require('mongoose');
const { MONGODB_URI } = require('./config/env');

mongoose.set('strictQuery', true);

// Mongoose queues operations issued while disconnected and only rejects them
// when this expires (default 10s). DB-backed routes are guarded by
// middlewares/requireDb.js so callers get an immediate 503 instead of waiting,
// but keep the fallback short: anything that slips past the guard should fail
// fast rather than pin a Passenger worker for ten seconds.
mongoose.set('bufferTimeoutMS', 5000);

const DEFAULTS = {
  serverSelectionTimeoutMS: 8000,
  retryDelayMs: 5000,
  maxRetryDelayMs: 60000,
};

let listenersBound = false;

// Bound only after the first successful connect. During the startup retry loop
// startDb() is already reporting every failure; binding these earlier would
// double-log the same problem in two different formats.
function bindConnectionListeners() {
  if (listenersBound) return;
  listenersBound = true;
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));
}

/**
 * One connection attempt. Rejects on failure.
 *
 * Still exported for the maintenance scripts and for callers that genuinely
 * cannot proceed without a database. The server does NOT use this directly -
 * see startDb().
 */
async function connectDb({ uri = MONGODB_URI, serverSelectionTimeoutMS = DEFAULTS.serverSelectionTimeoutMS } = {}) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env.');
  }
  await mongoose.connect(uri, {
    // Managed hosts (Azure, Hostinger) sit behind load balancers that silently
    // cull idle outbound TCP flows. Retiring sockets on our own schedule avoids
    // handing the driver a connection the network has already dropped.
    maxIdleTimeMS: 120000,
    serverSelectionTimeoutMS,
  });
  console.log('MongoDB connected');
  bindConnectionListeners();
}

/**
 * Connects in the background, retrying with exponential backoff. Never throws
 * and never blocks the caller.
 *
 * This exists because the first boot on a new host is the boot most likely to
 * fail: Atlas allowlists outbound IPs, and a new host's IP is not on the list
 * until someone adds it. If listen() waited on this, that failure would present
 * as a Passenger 502 with /health unreachable - no way to tell "wrong URI" from
 * "app crashed" from "wrong startup file". Connecting in the background instead
 * means the process is up, the dashboard is served, and /health can say
 * db:"disconnected", which names the actual problem.
 *
 * Returns a handle: { attempts, connected, ready, stop() }.
 */
function startDb(options = {}) {
  const {
    uri = MONGODB_URI,
    serverSelectionTimeoutMS = DEFAULTS.serverSelectionTimeoutMS,
    retryDelayMs = DEFAULTS.retryDelayMs,
    maxRetryDelayMs = DEFAULTS.maxRetryDelayMs,
  } = options;

  const state = { attempts: 0, connected: false, stopped: false };
  let timer = null;
  let delay = retryDelayMs;

  async function attempt() {
    if (state.stopped) return;
    state.attempts += 1;

    try {
      await connectDb({ uri, serverSelectionTimeoutMS });
      state.connected = true;
      delay = retryDelayMs; // reset backoff so a later drop retries promptly
    } catch (err) {
      if (state.stopped) return;

      // Loud, and actionable on its own: a Passenger stderr log is often the
      // only thing whoever is debugging this can see.
      console.error(
        `MongoDB connection attempt ${state.attempts} failed: ${err.message} | ` +
          `retrying in ${delay}ms | the app is still serving requests and ` +
          '/health will report db:"disconnected" until this succeeds'
      );

      // Drop the half-open client before retrying, otherwise the driver keeps
      // its own selection loop running alongside ours.
      await mongoose.disconnect().catch(() => {});
      if (state.stopped) return;

      timer = setTimeout(() => {
        timer = null;
        attempt();
      }, delay);
      // The HTTP server keeps the event loop alive; this timer should not be
      // what holds the process open (and must not hang the test runner).
      if (typeof timer.unref === 'function') timer.unref();

      delay = Math.min(delay * 2, maxRetryDelayMs);
    }
  }

  async function stop() {
    state.stopped = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    await mongoose.disconnect().catch(() => {});
  }

  if (!uri) {
    // Retrying cannot fix an unset environment variable, so do not spam the log
    // forever - say it once, clearly, and leave /health to report the state.
    console.error(
      'MONGODB_URI is not set, so the database will not be connected. ' +
        'Set it in hPanel (Node.js -> Environment variables) and restart. ' +
        'The app is still serving requests; /health will report db:"disconnected".'
    );
    return { get attempts() { return 0; }, get connected() { return false; }, ready: Promise.resolve(), stop };
  }

  const ready = attempt().catch((err) => {
    // attempt() handles its own errors; this only catches a bug in the handler.
    console.error('MongoDB retry loop crashed:', err.message);
  });

  return {
    get attempts() {
      return state.attempts;
    },
    get connected() {
      return state.connected;
    },
    ready,
    stop,
  };
}

// 0=disconnected 1=connected 2=connecting 3=disconnecting
function dbState() {
  return mongoose.connection.readyState;
}

function isDbConnected() {
  return dbState() === 1;
}

module.exports = { connectDb, startDb, dbState, isDbConnected };
