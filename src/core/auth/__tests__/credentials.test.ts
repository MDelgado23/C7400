import {
  normalizeEmail,
  isValidEmail,
  passwordIssue,
  MIN_PASSWORD_LENGTH,
} from '../credentials';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    // Mobile keyboards auto-capitalize the first letter and autocomplete drops a
    // trailing space. Both produce an address the user believes they typed
    // correctly, and a sign-in that fails for a reason no message can explain.
    expect(normalizeEmail('  Martin@Gmail.com ')).toBe('martin@gmail.com');
  });

  it('leaves an already-clean address untouched', () => {
    expect(normalizeEmail('martin@gmail.com')).toBe('martin@gmail.com');
  });
});

describe('isValidEmail', () => {
  it.each([
    'martin@gmail.com',
    'martin.delgado@lu32.com.ar',
    'martin+radio@gmail.com',
    'm@x.ar',
  ])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['martin', 'no @'],
    ['martin@', 'no domain'],
    ['@gmail.com', 'no local part'],
    ['martin@gmail', 'domain with no dot'],
    ['mar tin@gmail.com', 'inner space'],
    ['martin@@gmail.com', 'double @'],
  ])('rejects %s (%s)', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  it('validates the normalized form, not the raw input', () => {
    // Otherwise every address a mobile keyboard produced would be rejected for a
    // leading space the user cannot even see.
    expect(isValidEmail('  Martin@Gmail.com ')).toBe(true);
  });
});

describe('passwordIssue', () => {
  it('accepts a password at the minimum length', () => {
    expect(passwordIssue('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it('reports a password below the minimum', () => {
    expect(passwordIssue('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe('too-short');
  });

  it('reports an empty password', () => {
    expect(passwordIssue('')).toBe('too-short');
  });

  it('is stricter than the provider floor', () => {
    // Firebase accepts 6 characters. We deliberately ask for more: the provider's
    // floor is the point below which it refuses, not the point above which an
    // account is safe. Enforcing it here also means the rejection arrives
    // instantly instead of after a network round-trip.
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThan(6);
  });

  it('never trims the password', () => {
    // A space is a legitimate password character. Trimming one silently changes
    // the user's secret, and the account becomes unreachable from any other
    // client that does not trim it the same way.
    const padded = ` ${'a'.repeat(MIN_PASSWORD_LENGTH - 1)}`;
    expect(passwordIssue(padded)).toBeNull();
  });
});
