import {
  AUTH_MODES,
  copyFor,
  submitActionFor,
  type AuthMode,
} from '../authSheetState';

describe('copyFor', () => {
  it.each(AUTH_MODES)('gives %s a title and a submit label', (mode) => {
    // Exhaustive by construction: a mode added without copy fails here rather
    // than rendering an empty sheet with a blank button.
    const copy = copyFor(mode);
    expect(copy.title.trim().length).toBeGreaterThan(0);
    expect(copy.submitLabel.trim().length).toBeGreaterThan(0);
  });

  it('asks for nothing on the intro, which is a pitch and not a form', () => {
    // The first thing the user sees must explain what they GET. A form with no
    // reason attached is the login wall this whole design exists to avoid.
    const copy = copyFor('intro');
    expect(copy.showEmail).toBe(false);
    expect(copy.showPassword).toBe(false);
  });

  it('asks for a password when creating or entering an account', () => {
    expect(copyFor('register')).toMatchObject({ showEmail: true, showPassword: true });
    expect(copyFor('signIn')).toMatchObject({ showEmail: true, showPassword: true });
  });

  it('asks only for the address when resetting', () => {
    expect(copyFor('reset')).toMatchObject({ showEmail: true, showPassword: false });
  });

  it('offers the reset path only where a forgotten password is the problem', () => {
    // On `register` there is no password to have forgotten, and on `reset` the
    // user is already there.
    expect(copyFor('signIn').showForgotPassword).toBe(true);
    expect(copyFor('register').showForgotPassword).toBe(false);
    expect(copyFor('reset').showForgotPassword).toBe(false);
  });
});

describe('submitActionFor', () => {
  it('upgrades the anonymous session instead of registering fresh', () => {
    // THE decision this module exists for. Registering fresh from an anonymous
    // session hands the user a new uid and silently drops everything they had
    // already saved — the exact data the account was offered to protect.
    expect(submitActionFor('register', true)).toBe('upgrade');
  });

  it('registers normally when there is no anonymous session to keep', () => {
    expect(submitActionFor('register', false)).toBe('register');
  });

  it.each([
    ['signIn', 'signIn'],
    ['reset', 'reset'],
  ] as [AuthMode, string][])('maps %s straight through', (mode, expected) => {
    // Neither depends on the anonymous session: signing in REPLACES it by
    // definition, and a reset touches no session at all.
    expect(submitActionFor(mode, true)).toBe(expected);
    expect(submitActionFor(mode, false)).toBe(expected);
  });

  it('has nothing to submit on the intro', () => {
    expect(submitActionFor('intro', true)).toBeNull();
  });
});
