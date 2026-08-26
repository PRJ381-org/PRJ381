/**
 * Lead capture against a real MongoDB.
 *
 * Leads are the one dataset that cannot be re-collected after the open day, and
 * the shipped Unreal client posts `hotspotId` while the new schema wants
 * `source`. These tests pin the server-side translation between the two.
 */
const request = require('supertest');
const app = require('../src/app');
const Lead = require('../src/models/Lead');
const { describeDb, connect, disconnect, clear } = require('./helpers/db');

describeDb('POST /api/leads (database-backed)', () => {
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(clear);

  test('stores a lead and defaults source to end_screen', async () => {
    const res = await request(app).post('/api/leads').send({ email: 'Student@Example.com' });

    expect(res.status).toBe(201);
    const lead = await Lead.findOne();
    expect(lead.email).toBe('student@example.com'); // normalised
    expect(lead.source).toBe('end_screen');
  });

  test('maps the shipped client hotspotId into a namespaced source', async () => {
    // CampusBackendClient.cpp sends hotspotId and nothing else. This mapping is
    // what lets us keep that build unchanged through the feature freeze.
    await request(app)
      .post('/api/leads')
      .send({ email: 'a@example.com', hotspotId: 'library-desk' });

    const lead = await Lead.findOne();
    expect(lead.source).toBe('hotspot:library-desk');
    // hotspotId is retained, not replaced - discarding data we already receive
    // would be irreversible.
    expect(lead.hotspotId).toBe('library-desk');
  });

  test('an explicit source from a future client wins over hotspotId', async () => {
    await request(app)
      .post('/api/leads')
      .send({ email: 'b@example.com', hotspotId: 'library-desk', source: 'open_day_stand' });

    const lead = await Lead.findOne();
    expect(lead.source).toBe('open_day_stand');
  });

  test('returns the derived source so the client can confirm attribution', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ email: 'c@example.com', hotspotId: 'sports-hall' });

    expect(res.body.source).toBe('hotspot:sports-hall');
  });

  test('persists sessionId so a lead can be tied back to its telemetry', async () => {
    await request(app)
      .post('/api/leads')
      .send({ email: 'd@example.com', sessionId: 'sess-xyz' });

    const lead = await Lead.findOne();
    expect(lead.sessionId).toBe('sess-xyz');
  });

  test('a duplicate email is currently accepted twice', async () => {
    // Documents today's behaviour rather than endorsing it: the unique email
    // index is Phase 5 and deliberately NOT enabled. If someone switches it on
    // without running the dedupe migration first, this test starts failing -
    // which is the intended early warning.
    await request(app).post('/api/leads').send({ email: 'dup@example.com' });
    const second = await request(app).post('/api/leads').send({ email: 'dup@example.com' });

    expect(second.status).toBe(201);
    expect(await Lead.countDocuments({ email: 'dup@example.com' })).toBe(2);
  });
});
