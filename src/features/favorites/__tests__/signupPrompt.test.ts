import { shouldPromptSignup, __resetSignupPrompt } from '../signupPrompt';

beforeEach(() => {
  __resetSignupPrompt();
});

it('never interrupts someone who already has an account', () => {
  expect(shouldPromptSignup(false)).toBe(false);
});

it('offers the account the first time an anonymous user saves something', () => {
  // The moment the offer finally means something: they have just kept an
  // article, so "no lo pierdas si cambiás de celular" is about a real thing
  // they own rather than an abstract benefit.
  expect(shouldPromptSignup(true)).toBe(true);
});

it('asks once per session and then leaves them alone', () => {
  // Someone who declined and kept saving has answered. Asking on every save
  // turns a helpful offer into the login wall the whole design avoids.
  shouldPromptSignup(true);

  expect(shouldPromptSignup(true)).toBe(false);
  expect(shouldPromptSignup(true)).toBe(false);
});

it('does not let a registered user burn the anonymous user\'s one chance', () => {
  // Only an offer actually shown counts. A registered user saving an article
  // sees nothing, so the single chance has to still be there for whoever is
  // signed in anonymously afterwards.
  shouldPromptSignup(false);

  expect(shouldPromptSignup(true)).toBe(true);
});
