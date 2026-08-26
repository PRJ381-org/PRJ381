/**
 * Lead.deriveSource is a pure function, so it is tested without a database.
 * The migration script reuses it, which is why it lives on the model rather than
 * in the controller - these cases therefore also cover the migration's mapping.
 */
const Lead = require('../src/models/Lead');

describe('Lead.deriveSource', () => {
  test('defaults to end_screen when given nothing', () => {
    expect(Lead.deriveSource({})).toBe('end_screen');
    expect(Lead.deriveSource()).toBe('end_screen');
  });

  test('namespaces a hotspot id', () => {
    expect(Lead.deriveSource({ hotspotId: 'library' })).toBe('hotspot:library');
  });

  test('prefers an explicit source', () => {
    expect(Lead.deriveSource({ source: 'kiosk', hotspotId: 'library' })).toBe('kiosk');
  });

  test('treats whitespace-only values as absent', () => {
    expect(Lead.deriveSource({ source: '   ' })).toBe('end_screen');
    expect(Lead.deriveSource({ hotspotId: '  ' })).toBe('end_screen');
    expect(Lead.deriveSource({ source: '  ', hotspotId: 'lab' })).toBe('hotspot:lab');
  });

  test('trims surrounding whitespace', () => {
    expect(Lead.deriveSource({ hotspotId: ' lab ' })).toBe('hotspot:lab');
    expect(Lead.deriveSource({ source: ' kiosk ' })).toBe('kiosk');
  });

  test('ignores non-string input rather than coercing it', () => {
    // A client sending hotspotId: 0 must not produce "hotspot:0".
    expect(Lead.deriveSource({ hotspotId: 0 })).toBe('end_screen');
    expect(Lead.deriveSource({ hotspotId: null })).toBe('end_screen');
    expect(Lead.deriveSource({ source: 42 })).toBe('end_screen');
  });

  test('is stable when re-applied to an already-derived value', () => {
    // The migration may be re-run; deriving twice must not double the prefix.
    const once = Lead.deriveSource({ hotspotId: 'library' });
    expect(Lead.deriveSource({ source: once })).toBe('hotspot:library');
  });
});
