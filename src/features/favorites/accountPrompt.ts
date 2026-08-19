/**
 * The account row on the saved-articles screen — PURE.
 *
 * WHY IT EXISTS: the contextual sheet fires at most once per session, and only
 * right after a save. Someone who tapped "Ahora no" had no remaining route to an
 * account anywhere in the app, and a registered user had nowhere to see which
 * account they were on or to sign out. Found on a real device, not in a test.
 *
 * It lives HERE, on the saved list, because this is the screen where an account
 * means something concrete: these are the articles that would disappear with the
 * phone. A permanent entry point that is also the contextual one.
 */

export type AccountIntent = 'signup' | 'signin';

export interface AccountAction {
  intent: AccountIntent;
  label: string;
}

export interface AccountPrompt {
  /** The situation, in the user's terms. */
  message: string;
  /** What can be done about it. Never empty. */
  actions: AccountAction[];
}

interface SessionSummary {
  isAnonymous: boolean;
  email: string | null;
}

/**
 * PURE. What to offer about the account, or `null` when there is nothing to say.
 *
 * `null` covers three cases, and the third is a decision rather than an absence:
 *
 * - auth has not reported yet;
 * - the anonymous sign-in failed;
 * - THE USER IS ALREADY SIGNED IN. Managing a session — seeing which account you
 *   are on, signing out — belongs to the Cuenta tab. This screen is about notes,
 *   and a destructive session action does not belong sitting above them.
 */
export function accountPromptFor(session: SessionSummary | null): AccountPrompt | null {
  if (session === null || !session.isAnonymous) return null;

  return {
    // States the risk rather than the feature. "Creá una cuenta" answers a
    // question nobody asked; this one answers "why would I?".
    message: 'Estas notas viven solo en este celular.',
    // BOTH doors, side by side. Someone who reinstalled the app already has an
    // account, and making them open a registration form and back out of it to
    // find the login is sending them through the wrong door on purpose.
    actions: [
      { intent: 'signup', label: 'Crear cuenta' },
      { intent: 'signin', label: 'Entrar' },
    ],
  };
}
