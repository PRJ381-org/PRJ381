/**
 * Runs before any test file is imported (jest `setupFiles`).
 *
 * src/config/env.js reads process.env once at require time and app.js builds the
 * CORS allowlist at require time too, so these must be set before the first
 * `require('../src/app')` - not inside a beforeAll.
 */
process.env.NODE_ENV = 'test';

// Any non-empty value works; tests sign and verify with the same secret.
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

// A real allowlist rather than "*", so the CORS tests exercise the branch that
// actually ships. Two entries because the bug we are guarding against is a
// comma-separated list being treated as one opaque string.
process.env.CORS_ORIGIN = 'https://dashboard.example.com,https://second.example.com';

// Never let a test touch a real cluster, even by accident.
delete process.env.MONGODB_URI;
