const { isDbConnected } = require('../db');

/**
 * Rejects a request that needs MongoDB when MongoDB is not connected.
 *
 * Without this, Mongoose buffers the query and the caller waits for
 * bufferTimeoutMS before getting an opaque failure. A headset retrying a lead
 * submission would sit on that timeout, and a dashboard panel would spin.
 * Answering immediately with 503 tells the caller to retry later and keeps the
 * worker free.
 *
 * MOUNTING ORDER MATTERS. This must be mounted AFTER requireAuth/requireRole on
 * protected routes. Mounted before them, an unauthenticated caller would get a
 * 503 instead of a 401 - which both weakens the auth contract the test suite
 * asserts and lets anonymous callers probe our infrastructure state.
 */
module.exports = function requireDb(req, res, next) {
  if (isDbConnected()) return next();

  res.set('Retry-After', '30');
  return res.status(503).json({
    success: false,
    message:
      'Database unavailable. The server is running but is not connected to MongoDB - see /health.',
  });
};
