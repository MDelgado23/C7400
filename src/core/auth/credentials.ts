/**
 * Credential hygiene — PURE input rules for the auth port.
 *
 * Everything here runs BEFORE a request leaves the device. Two reasons, and the
 * second is the one that matters: a typo does not deserve a network round-trip,
 * and more importantly the provider's error for a malformed address is
 * indistinguishable from its error for a rejected one — so validating locally is
 * what lets the UI say "revisá el mail" instead of "no pudimos entrar".
 */

/**
 * Our floor, deliberately above Firebase's 6. A provider's minimum is the point
 * below which it refuses, not the point above which an account is safe.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Local part and domain with no whitespace and no second `@`, and a domain that
 * carries a dot. Not RFC 5322 — nothing short of sending the mail proves an
 * address exists, and a stricter pattern only rejects real addresses. This
 * catches what users actually mistype.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PURE. The canonical form of an address.
 *
 * Mobile keyboards auto-capitalize the first letter and autocomplete leaves a
 * trailing space — both produce an address the user is certain they typed
 * correctly, and a sign-in failure no error message can explain. Normalizing on
 * the way in also means the address we register and the address we later sign in
 * with are the same string.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** PURE. Whether an address is plausibly deliverable, judged on its normalized form. */
export function isValidEmail(raw: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(raw));
}

/** Why a password was refused. One value today; the shape admits more. */
export type PasswordIssue = 'too-short';

/**
 * PURE. Checks a password against our policy, returning the reason it failed or
 * `null` when it passes.
 *
 * The password is NEVER trimmed. A space is a legitimate password character;
 * trimming one silently changes the user's secret and locks the account away
 * from every client that does not trim it identically.
 */
export function passwordIssue(password: string): PasswordIssue | null {
  return password.length < MIN_PASSWORD_LENGTH ? 'too-short' : null;
}
