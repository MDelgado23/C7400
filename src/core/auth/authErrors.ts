/**
 * Auth failure vocabulary — PURE translation from provider codes to the app's
 * own, plus the message the user reads.
 *
 * The point of the mapping is not tidiness. Vendor codes are a moving target
 * (Firebase collapsed three sign-in failures into one in a recent version), and
 * a UI that branches on `auth/wrong-password` breaks the day that string
 * changes. Branching on OUR codes means a provider change is a change to this
 * file.
 *
 * The second job is security. Two of the mappings here exist specifically to
 * close a user-enumeration oracle — see `wrong-credentials`.
 */

import { MIN_PASSWORD_LENGTH } from './credentials';

/**
 * Every failure the app can distinguish. Exported as a tuple so tests can prove
 * that every one of them has a message, instead of discovering a blank alert in
 * production.
 */
export const AUTH_ERROR_CODES = [
  /** The address is not shaped like an address. Caught locally, before any request. */
  'invalid-email',
  /** Below our password policy. Also caught locally. */
  'weak-password',
  /** Registration refused: that address already has an account. */
  'email-already-in-use',
  /**
   * Linking refused: the address belongs to a DIFFERENT account. Distinct from
   * `email-already-in-use` because the recovery differs — the UI must offer to
   * sign in to that account AND warn that what was saved anonymously will not
   * come along.
   */
  'credential-already-in-use',
  /** Sign-in refused. Deliberately says nothing about which half was wrong. */
  'wrong-credentials',
  /**
   * The CURRENT password given while changing it is wrong.
   *
   * Deliberately NOT folded into `wrong-credentials`. That collapse exists to
   * stop an attacker learning which addresses are registered — at sign-in, where
   * they do not know yet. By the time someone is changing their password they
   * are already signed in and the account is known, so naming the wrong field
   * protects nothing and saves them from guessing.
   */
  'wrong-current-password',
  /** The new password offered is the one already in use. */
  'same-password',
  /** The request never reached the provider. */
  'network',
  /** Rate-limited by the provider after repeated attempts. */
  'too-many-requests',
  /** The operation needs a fresh sign-in before the provider will allow it. */
  'requires-recent-login',
  /** The sign-in method is not enabled in the provider console. A config bug, not a user one. */
  'method-disabled',
  /** No provider registered, or the session is not in a state that admits this operation. */
  'unavailable',
  /** Anything we have not seen. Carries the original as `cause`. */
  'unknown',
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/** An auth failure the app knows how to talk about. */
export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? code, options);
    this.name = 'AuthError';
    this.code = code;
    // Restores the prototype chain. Class syntax that gets down-levelled by
    // Babel loses it when extending a built-in, which makes `instanceof
    // AuthError` return false for an error this constructor just produced —
    // silently sending every failure down the `unknown` branch.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Provider code → our code.
 *
 * `invalid-credential`, `wrong-password` and `user-not-found` all collapse into
 * one value ON PURPOSE. Keeping them apart is a user-enumeration oracle: anyone
 * can ask the app which addresses are registered by watching which error comes
 * back. Firebase already collapses them in recent versions; we do not undo that.
 */
const PROVIDER_CODES: Record<string, AuthErrorCode> = {
  'auth/invalid-email': 'invalid-email',
  'auth/weak-password': 'weak-password',
  'auth/email-already-in-use': 'email-already-in-use',
  'auth/credential-already-in-use': 'credential-already-in-use',
  'auth/account-exists-with-different-credential': 'credential-already-in-use',
  'auth/invalid-credential': 'wrong-credentials',
  'auth/wrong-password': 'wrong-credentials',
  'auth/user-not-found': 'wrong-credentials',
  'auth/invalid-login-credentials': 'wrong-credentials',
  'auth/network-request-failed': 'network',
  'auth/too-many-requests': 'too-many-requests',
  'auth/requires-recent-login': 'requires-recent-login',
  'auth/operation-not-allowed': 'method-disabled',
};

/**
 * PURE. Coerces whatever a provider threw into an `AuthError`.
 *
 * Never throws itself: this runs inside the catch block of every operation, and
 * an error handler that fails leaves the caller with no error at all.
 */
export function toAuthError(value: unknown): AuthError {
  if (value instanceof AuthError) return value;

  if (typeof value === 'object' && value !== null) {
    const { code, message } = value as { code?: unknown; message?: unknown };
    const mapped = typeof code === 'string' ? PROVIDER_CODES[code] : undefined;
    // The provider's own message is kept verbatim — it is the only thing that
    // makes an `unknown` report worth opening in Crashlytics. It is NOT what the
    // user sees; that comes from `messageFor`.
    const detail = typeof message === 'string' && message.length > 0 ? message : undefined;
    return new AuthError(mapped ?? 'unknown', detail, { cause: value });
  }

  return new AuthError('unknown', String(value), { cause: value });
}

/**
 * The message shown to the user. Rioplatense, second person, and it always says
 * what to DO — an error the user cannot act on is just a dead end with a border.
 */
const MESSAGES: Record<AuthErrorCode, string> = {
  'invalid-email': 'Revisá el mail: parece que le falta algo.',
  'weak-password': `La contraseña necesita al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  'email-already-in-use': 'Ese mail ya tiene una cuenta. Probá iniciar sesión.',
  'credential-already-in-use': 'Ese mail ya tiene una cuenta. Iniciá sesión con ella.',
  // Says nothing about which half was wrong: the whole point of collapsing the
  // provider codes is lost if the message hands the distinction back.
  'wrong-credentials': 'El mail o la contraseña no coinciden. Probá de nuevo.',
  'wrong-current-password': 'La contraseña actual no coincide.',
  'same-password': 'La contraseña nueva tiene que ser distinta de la actual.',
  network: 'No hay conexión. Fijate el internet y volvé a intentar.',
  'too-many-requests': 'Demasiados intentos. Esperá un ratito y probá de nuevo.',
  'requires-recent-login': 'Por seguridad, volvé a iniciar sesión antes de hacer esto.',
  'method-disabled': 'Ese método de acceso no está disponible por ahora.',
  unavailable: 'No pudimos completar la operación. Probá de nuevo en un momento.',
  unknown: 'Algo salió mal. Probá de nuevo en un momento.',
};

/** The user-facing text for a failure. Never empty — the record is exhaustive by type. */
export function messageFor(code: AuthErrorCode): string {
  return MESSAGES[code];
}
