import { normalizeEmail, isValidEmail, passwordIssue } from './credentials';
import { AuthError, toAuthError } from './authErrors';
import { trackEvent } from '../observability/observability';
import { EVENTS } from '../observability/events';

/**
 * Auth port — provider-agnostic identity for the app.
 *
 * Same shape as `observability` and `remoteConfig`: call sites depend on THIS
 * module, the vendor enters through an adapter registered once at boot, and
 * swapping providers touches one file.
 *
 * THE INVARIANT IS THE OPPOSITE ONE, and the difference is the whole design.
 * Observability swallows everything, because a radio that stops playing over a
 * failed analytics call is strictly worse than a radio with no analytics. Auth
 * cannot do that: a sign-in that reports success while nothing happened leaves
 * the user tapping a dead button with no idea why. So every USER-INITIATED
 * operation here rejects, loudly, with a code the UI can act on.
 *
 * The one exception is `startAnonymousSession`, and it proves the rule: nobody
 * tapped anything, so there is nobody to show an error to — and the radio has to
 * play with or without an identity behind it.
 *
 * WHY ANONYMOUS-FIRST: this is a radio app. Most people open it, press play and
 * pocket the phone. A login wall at the door costs listeners and buys nothing,
 * so identity starts silent and is PROMOTED to a real account (same uid, saved
 * articles intact) the day the user wants something that outlives the device.
 */

/**
 * The user as the app understands one.
 *
 * Deliberately NOT the provider's user object. Firebase's carries
 * `refreshToken`, `providerData`, `multiFactor` and a `delete()` method — none
 * of which any screen has business touching, and all of which would leak the
 * vendor straight through the port it is supposed to hide.
 */
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  /** True while the account exists only on this device. */
  isAnonymous: boolean;
  emailVerified: boolean;
}

/**
 * What a provider must implement. Every method speaks `AppUser`, never a vendor
 * type, and receives an address that is already normalized and validated.
 */
export interface AuthProvider {
  signInAnonymously(): Promise<AppUser>;
  createWithEmail(email: string, password: string): Promise<AppUser>;
  signInWithEmail(email: string, password: string): Promise<AppUser>;
  /** Attaches an email credential to the CURRENT (anonymous) session, keeping its uid. */
  linkEmail(email: string, password: string): Promise<AppUser>;
  sendPasswordReset(email: string): Promise<void>;
  /**
   * Re-authenticates with the current password, then sets the new one. The two
   * halves belong together: a provider that changed the password without
   * proving the old one would let anyone holding an unlocked phone take the
   * account.
   */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  signOut(): Promise<void>;
  /** Session changes, including the ones we did not initiate. Returns an unsubscribe. */
  onUserChanged(listener: (user: AppUser | null) => void): () => void;
}

type UserListener = (user: AppUser | null) => void;

/**
 * How long to wait for the provider's first report before acting without it.
 *
 * A provider that never reports is broken, and `signInAnonymously` will very
 * likely fail too — but waiting forever GUARANTEES the app has no identity,
 * while giving up risks nothing worse than the failure we already handle.
 */
const SESSION_RESTORE_TIMEOUT_MS = 5000;

let provider: AuthProvider | null = null;
let providerUnsubscribe: (() => void) | null = null;
let currentUser: AppUser | null = null;
const listeners = new Set<UserListener>();

/**
 * Whether the provider has told us what session it found on this device.
 *
 * Until it has, `currentUser === null` means "we do not know yet", NOT "nobody
 * is signed in" — and confusing the two is how an account gets orphaned. See
 * `startAnonymousSession`.
 */
let sessionSettled = false;
let settleWaiters: (() => void)[] = [];

/** Register the provider adapter. Called once at boot. */
export function setAuthProvider(next: AuthProvider): void {
  providerUnsubscribe?.();
  provider = next;
  providerUnsubscribe = next.onUserChanged(onProviderReport);
}

/** Test hook — drops the provider and every subscriber. */
export function __resetAuth(): void {
  providerUnsubscribe?.();
  providerUnsubscribe = null;
  provider = null;
  currentUser = null;
  sessionSettled = false;
  settleWaiters = [];
  listeners.clear();
}

/**
 * The provider's report. Marks the session known BEFORE adopting, because
 * `adopt` drops a no-change report — and "still nobody signed in" is exactly the
 * report that has to settle the question.
 */
function onProviderReport(user: AppUser | null): void {
  sessionSettled = true;
  const waiters = settleWaiters;
  settleWaiters = [];
  for (const resume of waiters) resume();
  adopt(user);
}

/** Resolves once the provider has reported, or once the wait has run out. */
function awaitSessionSettled(): Promise<void> {
  if (sessionSettled) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      settleWaiters = settleWaiters.filter((waiter) => waiter !== resume);
      resolve();
    }, SESSION_RESTORE_TIMEOUT_MS);
    const resume = () => {
      clearTimeout(timer);
      resolve();
    };
    settleWaiters.push(resume);
  });
}

/** Whether two snapshots describe the same session in the same state. */
function sameUser(a: AppUser | null, b: AppUser | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.uid === b.uid &&
    a.email === b.email &&
    a.displayName === b.displayName &&
    a.isAnonymous === b.isAnonymous &&
    a.emailVerified === b.emailVerified
  );
}

/**
 * Records a new session state and fans it out.
 *
 * Identical states are dropped: an operation resolves with the same user its
 * listener is about to report, and re-notifying would re-render every subscribed
 * screen for no change.
 */
function adopt(user: AppUser | null): void {
  if (sameUser(currentUser, user)) return;
  currentUser = user;
  for (const listener of listeners) notify(listener, user);
}

/**
 * Delivers to one listener without letting it take the others down. A screen
 * that throws while reacting to a sign-in must not leave the rest of the app
 * believing the user is still signed out.
 */
function notify(listener: UserListener, user: AppUser | null): void {
  try {
    listener(user);
  } catch {
    // A subscriber's bug is a subscriber's problem.
  }
}

/** The signed-in user, or `null`. Synchronous — safe to read during render. */
export function getCurrentUser(): AppUser | null {
  return currentUser;
}

/**
 * Subscribes to session changes. Returns an unsubscribe.
 *
 * A subscriber that arrives when someone is already signed in is told
 * immediately, so a screen mounted after sign-in does not render as signed-out
 * until something unrelated changes the session. `null` is NOT replayed: that is
 * the state every screen already assumes before it hears otherwise, and
 * announcing it adds a render without adding information.
 */
export function subscribeToUser(listener: UserListener): () => void {
  listeners.add(listener);
  if (currentUser !== null) notify(listener, currentUser);
  return () => {
    listeners.delete(listener);
  };
}

/** The provider, or a domain error naming the reason there isn't one. */
function requireProvider(): AuthProvider {
  if (provider === null) {
    throw new AuthError('unavailable', 'no auth provider registered');
  }
  return provider;
}

/** Runs a provider call, adopting its result and translating any failure. */
async function run(operation: () => Promise<AppUser>): Promise<AppUser> {
  try {
    const user = await operation();
    adopt(user);
    return user;
  } catch (error) {
    throw toAuthError(error);
  }
}

/**
 * Gives the device an identity at boot, if it does not have one.
 *
 * Resolves to `null` rather than rejecting — see the invariant note above.
 *
 * Guarded against signing in twice: every anonymous sign-in mints a NEW uid, so
 * calling it over an existing session orphans the previous account and
 * everything attached to it — which is precisely the saved-articles data the
 * account existed to hold.
 *
 * AND THE GUARD IS NOT ENOUGH ON ITS OWN. At cold boot the provider restores the
 * previous session asynchronously, so for a moment there is a real account on
 * the device while `currentUser` still reads null. Checking inside that window
 * orphans the account it was written to protect, which is why this waits for the
 * provider to report before it decides anything.
 */
export async function startAnonymousSession(): Promise<AppUser | null> {
  if (provider === null) return null;
  await awaitSessionSettled();
  if (currentUser !== null) return currentUser;

  try {
    const user = await provider.signInAnonymously();
    adopt(user);
    return user;
  } catch (error) {
    // Worth reporting precisely because nothing else will: no screen showed an
    // error, nothing crashed, and the user simply never gets an identity —
    // every save silently does nothing. The exact class of silent failure the
    // event catalog exists for.
    trackEvent(EVENTS.AUTH_SESSION_FAILED, { reason: toAuthError(error).code });
    return null;
  }
}

/** Creates a brand-new account. Rejects with an `AuthError` on any failure. */
export async function registerWithEmail(rawEmail: string, password: string): Promise<AppUser> {
  const auth = requireProvider();
  const email = requireValidEmail(rawEmail);
  requireAcceptablePassword(password);
  return run(() => auth.createWithEmail(email, password));
}

/**
 * Signs in to an existing account.
 *
 * The password policy is NOT applied here. It guards what we create; enforcing
 * it at sign-in would lock out every account made before the rule existed, with
 * a message blaming the user for a password we ourselves accepted.
 */
export async function signInWithEmail(rawEmail: string, password: string): Promise<AppUser> {
  const auth = requireProvider();
  const email = requireValidEmail(rawEmail);
  return run(() => auth.signInWithEmail(email, password));
}

/**
 * Promotes the anonymous session into a real account, KEEPING THE UID.
 *
 * This is the payoff of anonymous-first: everything saved before registering
 * stays attached to the same identity. Registering fresh instead would hand the
 * user a new uid and drop it all without a word.
 */
export async function upgradeToEmailAccount(
  rawEmail: string,
  password: string,
): Promise<AppUser> {
  const auth = requireProvider();
  if (currentUser === null || !currentUser.isAnonymous) {
    // Linking onto a registered account is a different operation with different
    // consequences. Reaching here means the UI offered the wrong action, and it
    // should read as our bug rather than as a provider error.
    throw new AuthError('unavailable', 'no anonymous session to upgrade');
  }
  const email = requireValidEmail(rawEmail);
  requireAcceptablePassword(password);
  const user = await run(() => auth.linkEmail(email, password));
  // The conversion this whole feature is justified by. Without it there is no
  // way to tell whether asking people to register was worth anything.
  trackEvent(EVENTS.AUTH_ACCOUNT_UPGRADED);
  return user;
}

/**
 * Starts a password reset.
 *
 * Resolves even when the address has no account. Failing only for unknown
 * addresses is the same enumeration oracle `authErrors` closes on sign-in — the
 * user is told "si el mail está registrado, ya te lo mandamos" either way. A
 * dead network is a different matter and still rejects: hiding that would leave
 * the user waiting for a mail nobody sent.
 */
export async function sendPasswordReset(rawEmail: string): Promise<void> {
  const auth = requireProvider();
  const email = requireValidEmail(rawEmail);
  try {
    await auth.sendPasswordReset(email);
  } catch (error) {
    const mapped = toAuthError(error);
    if (mapped.code === 'wrong-credentials') return;
    throw mapped;
  }
}

/**
 * Changes the password of the signed-in account.
 *
 * THE CURRENT PASSWORD IS NOT OPTIONAL. Firebase would happily set a new one on
 * a recently-signed-in user without it, and that is exactly how somebody who
 * picks up an unlocked phone takes the account: change the password, and the
 * owner is locked out of their own. Proving the old one first is what makes this
 * a change rather than a seizure.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const auth = requireProvider();
  if (currentUser === null || currentUser.isAnonymous) {
    // An anonymous session has no password to change, and no way to prove one.
    throw new AuthError('unavailable', 'no password account signed in');
  }
  // The policy guards what we SET. Applying it to the current password would
  // lock out every account made before the rule existed — out of the very
  // screen that exists to fix their password.
  requireAcceptablePassword(newPassword);
  if (currentPassword === newPassword) {
    // Firebase accepts this and changes nothing. The user would walk away
    // believing they rotated a password they did not.
    throw new AuthError('same-password');
  }

  try {
    await auth.changePassword(currentPassword, newPassword);
  } catch (error) {
    const mapped = toAuthError(error);
    // Re-mapped HERE, where the context is known: the provider returns the same
    // code it uses for a failed sign-in, and "el mail o la contraseña no
    // coinciden" is nonsense on a form with no mail field on it.
    if (mapped.code === 'wrong-credentials') {
      throw new AuthError('wrong-current-password', mapped.message, { cause: mapped.cause });
    }
    throw mapped;
  }
}

/** Ends the session. */
export async function signOut(): Promise<void> {
  const auth = requireProvider();
  try {
    await auth.signOut();
    adopt(null);
  } catch (error) {
    throw toAuthError(error);
  }
}

/** Normalized address, or a domain error. */
function requireValidEmail(rawEmail: string): string {
  if (!isValidEmail(rawEmail)) throw new AuthError('invalid-email');
  return normalizeEmail(rawEmail);
}

/** Throws when the password fails our policy. */
function requireAcceptablePassword(password: string): void {
  if (passwordIssue(password) !== null) throw new AuthError('weak-password');
}
