import { AuthError, toAuthError, messageFor, AUTH_ERROR_CODES } from '../authErrors';

describe('toAuthError', () => {
  it.each([
    ['auth/invalid-email', 'invalid-email'],
    ['auth/email-already-in-use', 'email-already-in-use'],
    ['auth/weak-password', 'weak-password'],
    ['auth/network-request-failed', 'network'],
    ['auth/too-many-requests', 'too-many-requests'],
    ['auth/requires-recent-login', 'requires-recent-login'],
    ['auth/credential-already-in-use', 'credential-already-in-use'],
    ['auth/operation-not-allowed', 'method-disabled'],
  ])('maps %s to %s', (providerCode, expected) => {
    const error = toAuthError({ code: providerCode, message: 'whatever' });
    expect(error).toBeInstanceOf(AuthError);
    expect(error.code).toBe(expected);
  });

  it.each(['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'])(
    'collapses %s into a single indistinguishable failure',
    (providerCode) => {
      // Deliberate: telling "no such account" apart from "wrong password" is a
      // user-enumeration oracle — anyone can probe which addresses are
      // registered. Firebase collapses these itself in recent versions; we do
      // not undo that by re-splitting them.
      expect(toAuthError({ code: providerCode, message: '' }).code).toBe('wrong-credentials');
    },
  );

  it('falls back to unknown for an unrecognized provider code', () => {
    expect(toAuthError({ code: 'auth/some-future-code', message: 'x' }).code).toBe('unknown');
  });

  it('keeps the original value as the cause', () => {
    // The mapped code is what the UI branches on; the original is what makes a
    // Crashlytics report worth reading.
    const original = { code: 'auth/some-future-code', message: 'boom' };
    expect(toAuthError(original).cause).toBe(original);
  });

  it('survives a value that is not an object', () => {
    const error = toAuthError('just a string');
    expect(error).toBeInstanceOf(AuthError);
    expect(error.code).toBe('unknown');
  });

  it('passes an AuthError through untouched', () => {
    // The port validates before it delegates, so some errors are ours already.
    // Re-wrapping one would bury its code under `unknown`.
    const original = new AuthError('invalid-email');
    expect(toAuthError(original)).toBe(original);
  });

  it('keeps the provider message for diagnosis', () => {
    const error = toAuthError({ code: 'auth/internal-error', message: 'backend exploded' });
    expect(error.message).toContain('backend exploded');
  });
});

describe('messageFor', () => {
  it.each(AUTH_ERROR_CODES)('returns a non-empty Spanish message for %s', (code) => {
    // Exhaustive by construction: adding a code without a message fails here
    // rather than showing the user a blank alert in production.
    expect(messageFor(code).trim().length).toBeGreaterThan(0);
  });

  it('never reveals whether an address is registered', () => {
    // The message the user sees must not restore the enumeration oracle that
    // `toAuthError` just closed.
    const message = messageFor('wrong-credentials').toLowerCase();
    expect(message).not.toContain('no existe');
    expect(message).not.toContain('no encontr');
  });
});
