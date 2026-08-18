import { isValidEventName, sanitizeParams, EVENTS } from '../events';

describe('isValidEventName', () => {
  it('accepts the app vocabulary', () => {
    for (const name of Object.values(EVENTS)) {
      expect(isValidEventName(name)).toBe(true);
    }
  });

  it('rejects names Firebase reserves for itself', () => {
    expect(isValidEventName('firebase_start')).toBe(false);
    expect(isValidEventName('google_signin')).toBe(false);
    expect(isValidEventName('ga_session')).toBe(false);
    // Case does not save it — the check is case-insensitive.
    expect(isValidEventName('Firebase_start')).toBe(false);
  });

  it('rejects names that do not start with a letter', () => {
    expect(isValidEventName('1st_play')).toBe(false);
    expect(isValidEventName('_private')).toBe(false);
  });

  it('rejects names with characters outside alphanumerics and underscore', () => {
    expect(isValidEventName('stream-drop')).toBe(false);
    expect(isValidEventName('stream drop')).toBe(false);
    expect(isValidEventName('stream.drop')).toBe(false);
  });

  it('rejects empty names and names over 40 characters', () => {
    expect(isValidEventName('')).toBe(false);
    expect(isValidEventName('a'.repeat(40))).toBe(true);
    expect(isValidEventName('a'.repeat(41))).toBe(false);
  });
});

describe('sanitizeParams', () => {
  it('keeps valid string and number parameters untouched', () => {
    expect(sanitizeParams({ attempt: 3, reason: 'timeout' })).toEqual({
      attempt: 3,
      reason: 'timeout',
    });
  });

  it('truncates strings to the 100-character limit', () => {
    const { reason } = sanitizeParams({ reason: 'x'.repeat(150) });
    expect(reason).toHaveLength(100);
  });

  it('stringifies booleans so they are not dropped', () => {
    expect(sanitizeParams({ online: true, exempt: false })).toEqual({
      online: 'true',
      exempt: 'false',
    });
  });

  it('drops parameters whose key Firebase would reject', () => {
    expect(sanitizeParams({ 'bad-key': 1, firebase_x: 2, ok: 3 })).toEqual({ ok: 3 });
  });

  it('drops non-finite numbers rather than sending NaN', () => {
    expect(sanitizeParams({ ratio: Number.NaN, count: Infinity, ok: 1 })).toEqual({
      ok: 1,
    });
  });

  it('caps the payload at 25 parameters', () => {
    const wide: Record<string, number> = {};
    for (let i = 0; i < 40; i += 1) wide[`p${i}`] = i;

    expect(Object.keys(sanitizeParams(wide))).toHaveLength(25);
  });

  it('returns an empty payload rather than throwing on an empty input', () => {
    expect(sanitizeParams({})).toEqual({});
  });
});
