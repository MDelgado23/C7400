/**
 * When to offer an account to someone saving articles anonymously.
 *
 * The offer is worth making exactly once: right after the FIRST save, when
 * "no lo pierdas si cambiás de celular" is about an article they just chose to
 * keep rather than an abstract benefit. Someone who declined and kept saving
 * has already answered — asking again on every save turns a helpful offer into
 * the login wall this whole design exists to avoid.
 *
 * Session-scoped on purpose. Persisting "no me preguntes más" would need a
 * store, and a fresh offer once per app launch is a fair trade for not carrying
 * one. Restarting the app is also the moment a reinstall would have cost them
 * the list, which is precisely what the offer is about.
 */

let offered = false;

/**
 * Whether to show the sign-up sheet now. Calling this COUNTS as the offer, so
 * call it only where the sheet will actually be shown.
 */
export function shouldPromptSignup(isAnonymous: boolean): boolean {
  // Only an offer actually made counts as one. A registered user saving an
  // article is never shown anything, so it must not consume the single chance
  // the anonymous case gets.
  if (!isAnonymous || offered) return false;
  offered = true;
  return true;
}

/** Test hook — forgets that the offer was made. */
export function __resetSignupPrompt(): void {
  offered = false;
}
