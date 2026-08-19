import { accountPromptFor } from '../accountPrompt';

function user(isAnonymous: boolean, email: string | null = null) {
  return { isAnonymous, email };
}

describe('accountPromptFor', () => {
  it('tells an anonymous user what they stand to lose', () => {
    // The permanent way in. The contextual sheet fires once per session and
    // only right after a save — someone who declined it had NO route to an
    // account at all, which is the gap this closes.
    expect(accountPromptFor(user(true))?.message).toBe(
      'Estas notas viven solo en este celular.',
    );
  });

  it('offers signing IN as its own door, not one buried behind signing up', () => {
    // Someone who reinstalled the app already HAS an account. Making them tap
    // "Crear cuenta" — then back out of a registration form — to reach a login
    // is asking them to walk through the wrong door on purpose.
    const actions = accountPromptFor(user(true))?.actions ?? [];

    expect(actions).toEqual([
      { intent: 'signup', label: 'Crear cuenta' },
      { intent: 'signin', label: 'Entrar' },
    ]);
  });

  it('says nothing at all to a signed-in user', () => {
    // Session management moved to the Cuenta tab. This screen is about notes,
    // and a "Cerrar sesión" sitting on top of them was both out of place and
    // one mistap away from emptying the list it was attached to.
    expect(accountPromptFor(user(false, 'martin@gmail.com'))).toBeNull();
  });

  it('offers nothing while there is no session to talk about', () => {
    // Before auth reports, or after it failed. Offering "Cerrar sesión" to
    // nobody, or promising to keep something we currently cannot, both read as
    // the app being confused about who is using it.
    expect(accountPromptFor(null)).toBeNull();
  });
});
