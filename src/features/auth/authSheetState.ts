/**
 * Auth sheet copy and branching — PURE.
 *
 * Kept out of the component for the usual reason (it is testable without a
 * renderer) and for one specific one: `submitActionFor` decides whether
 * registering PROMOTES the anonymous session or starts a fresh account, and
 * getting that wrong silently destroys the user's saved data. That decision
 * deserves a test that does not depend on a button being wired correctly.
 */

/** Every step the sheet can be on. Exported so tests can be exhaustive. */
export const AUTH_MODES = ['intro', 'register', 'signIn', 'reset'] as const;

export type AuthMode = (typeof AUTH_MODES)[number];

/** What the user is actually asked to do when they submit. */
export type AuthAction = 'upgrade' | 'register' | 'signIn' | 'reset';

export interface AuthModeCopy {
  title: string;
  /** The reason to go on. On the intro this is the entire product pitch. */
  body: string;
  submitLabel: string;
  showEmail: boolean;
  showPassword: boolean;
  showForgotPassword: boolean;
}

const COPY: Record<AuthMode, AuthModeCopy> = {
  /**
   * A pitch, not a form. The sheet only ever opens because the user reached for
   * something an account unlocks, so the first thing it does is name that thing.
   * Opening on empty fields is the login wall this whole design avoids.
   */
  intro: {
    title: 'Guardá tus noticias',
    body: 'Con una cuenta te llevás lo que guardaste a cualquier celular, y elegís de qué te querés enterar.',
    submitLabel: 'Crear cuenta',
    showEmail: false,
    showPassword: false,
    showForgotPassword: false,
  },
  register: {
    title: 'Creá tu cuenta',
    body: 'Lo que ya guardaste sigue siendo tuyo.',
    submitLabel: 'Crear mi cuenta',
    showEmail: true,
    showPassword: true,
    // Nothing has been forgotten yet: there is no password on this account.
    showForgotPassword: false,
  },
  signIn: {
    title: 'Iniciá sesión',
    body: 'Entrá con el mail y la contraseña de tu cuenta.',
    submitLabel: 'Entrar',
    showEmail: true,
    showPassword: true,
    showForgotPassword: true,
  },
  reset: {
    title: 'Recuperá tu contraseña',
    body: 'Poné tu mail y te mandamos un enlace para cambiarla.',
    submitLabel: 'Mandame el enlace',
    showEmail: true,
    // The password is precisely what the user does not have.
    showPassword: false,
    showForgotPassword: false,
  },
};

/** PURE. The copy and field layout for a step. */
export function copyFor(mode: AuthMode): AuthModeCopy {
  return COPY[mode];
}

/**
 * PURE. What submitting this step should actually call, or `null` when the step
 * has nothing to submit.
 *
 * The one branch that matters: registering from an ANONYMOUS session must
 * promote it, keeping the uid. Creating a fresh account instead hands the user a
 * new identity and drops everything the old one held — the saved articles the
 * account was offered to protect in the first place.
 *
 * Signing in and resetting do not consult the session: signing in replaces it by
 * definition, and a reset touches no session at all.
 */
export function submitActionFor(mode: AuthMode, isAnonymous: boolean): AuthAction | null {
  switch (mode) {
    case 'register':
      return isAnonymous ? 'upgrade' : 'register';
    case 'signIn':
      return 'signIn';
    case 'reset':
      return 'reset';
    case 'intro':
      return null;
  }
}
