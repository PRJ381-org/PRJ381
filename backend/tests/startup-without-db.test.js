/**
 * The app must survive being started with no reachable database.
 *
 * This is not a hypothetical. Atlas allowlists outbound IPs, so the FIRST boot
 * on a new host is very likely to fail to connect. If listen() is gated behind
 * that connection, the failure presents as a Passenger 502 with /health
 * unreachable - the least diagnosable outcome possible. Listening first turns
 * the same failure into /health answering 200 with db:"disconnected", which is
 * what /health was designed to report.
 *
 * Deliberately DB-free (no `db.` filename prefix): these assertions are about
 * what happens when there is no database, so they must run everywhere, always.
 */
const request = require('supertest');
const mongoose = require('mongoose');

// Nothing listens on port 1. Connections are refused immediately, so the only
// delay is Mongoose's own server-selection timeout, which the tests override.
const UNREACHABLE_URI = 'mongodb://127.0.0.1:1/prj381-unreachable';

const FAST_DB_OPTIONS = {
  uri: UNREACHABLE_URI,
  serverSelectionTimeoutMS: 250,
  retryDelayMs: 40,
  maxRetryDelayMs: 40,
};

/** Polls until `predicate()` is true, or throws once `timeoutMs` has elapsed. */
async function waitFor(predicate, { timeoutMs = 5000, label = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`);
}

describe('startup with an unreachable database', () => {
  let handle;

  afterEach(async () => {
    if (handle) await handle.stop();
    handle = null;
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });

  test('listens even though the database connection fails', async () => {
    const { startServer } = require('../src/server');

    // Resolving at all is the assertion: startServer must not wait on the
    // database. If it did, this would reject or hang instead.
    handle = await startServer({ port: 0, db: FAST_DB_OPTIONS });

    expect(handle.server.listening).toBe(true);
    expect(typeof handle.server.address().port).toBe('number');
  });

  test('/health answers 200 while the first connection attempt is still in flight', async () => {
    const { startServer } = require('../src/server');
    handle = await startServer({ port: 0, db: FAST_DB_OPTIONS });

    const { port } = handle.server.address();
    const res = await request(`http://127.0.0.1:${port}`).get('/health');

    // 200, NOT 503. A 503 here would make Passenger consider the app unhealthy
    // and restart it in a loop, which is exactly what /health exists to avoid.
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    // "connecting" is the honest answer at this instant; the one thing it must
    // never claim while the database is unreachable is that it is connected.
    expect(res.body.db).not.toBe('connected');
  });

  test('/health reports db:"disconnected" once the attempt has failed', async () => {
    const { startServer } = require('../src/server');
    // A long retry delay holds the connection in the failed state long enough to
    // observe it, instead of flipping straight back to "connecting".
    handle = await startServer({
      port: 0,
      db: { ...FAST_DB_OPTIONS, retryDelayMs: 3000, maxRetryDelayMs: 3000 },
    });

    const { port } = handle.server.address();
    const agent = request(`http://127.0.0.1:${port}`);

    let body;
    await waitFor(
      async () => {
        const res = await agent.get('/health');
        expect(res.status).toBe(200); // must stay 200 at every point, not just at the end
        body = res.body;
        return body.db === 'disconnected';
      },
      { label: '/health to report a failed connection' }
    );

    expect(body.status).toBe('ok');
    expect(body.db).toBe('disconnected');
    expect(body.dbState).toBe(0);
    // Still reports everything the deploy check relies on.
    expect(body.version).toBeTruthy();
    expect(body.startedAt).toBeTruthy();
  });

  test('retries the connection in the background, logging every failure', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { startServer } = require('../src/server');
      handle = await startServer({ port: 0, db: FAST_DB_OPTIONS });

      // Wait on the log itself, not on the attempt counter: the counter is
      // incremented when an attempt STARTS, so it reaches 2 before the second
      // failure has been reported.
      await waitFor(() => errorSpy.mock.calls.length >= 2, { label: 'a second logged failure' });

      // Capture before restoring - mockRestore() wipes mock.calls.
      const logged = errorSpy.mock.calls.map((args) => args.join(' '));
      expect(logged.length).toBeGreaterThanOrEqual(2);
      expect(handle.db.attempts).toBeGreaterThanOrEqual(2);

      // Every failure must name the subsystem and say a retry is coming, so the
      // line is actionable on its own in a Passenger stderr log.
      for (const line of logged) {
        expect(line).toMatch(/mongo/i);
        expect(line).toMatch(/retry/i);
      }
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe('database-dependent routes while disconnected', () => {
  // No server needed - these exercise the middleware, not the socket.
  const app = require('../src/app');

  test('a public write route answers 503 quickly instead of hanging on the buffer', async () => {
    const startedAt = Date.now();
    const res = await request(app).post('/api/leads').send({ email: 'prospect@example.com' });
    const elapsed = Date.now() - startedAt;

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/database/i);

    // Mongoose would otherwise buffer the query and fail at 10s. The point of
    // the guard is that the caller finds out immediately.
    expect(elapsed).toBeLessThan(1000);
  });

  test('an authenticated read route answers 503 for a valid token', async () => {
    const { signSessionToken } = require('../src/utils/jwt');
    const token = signSessionToken({ _id: 'u1', email: 'admin@example.com', role: 'admin' });

    const res = await request(app).get('/api/leads').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/database/i);
  });

  test('authentication is still checked BEFORE the database guard', async () => {
    // Security ordering. An anonymous caller must be rejected as unauthenticated
    // whatever the database is doing - a 503 here would mean the guard had been
    // mounted ahead of requireAuth, letting an unauthenticated request probe
    // infrastructure state.
    const anonymous = await request(app).get('/api/leads');
    expect(anonymous.status).toBe(401);

    const badToken = await request(app).get('/api/leads').set('Authorization', 'Bearer nonsense');
    expect(badToken.status).toBe(401);
  });

  test('the role check still runs before the database guard', async () => {
    const { signSessionToken } = require('../src/utils/jwt');
    const viewer = signSessionToken({ _id: 'u2', email: 'viewer@example.com', role: 'viewer' });

    const res = await request(app).get('/api/export/leads').set('Authorization', `Bearer ${viewer}`);

    expect(res.status).toBe(403);
  });

  test('/health is never gated by the database guard', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  test('the dashboard is still served while the database is down', async () => {
    // The whole point of the merge: a database outage must not take the staff
    // dashboard offline with it.
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});
