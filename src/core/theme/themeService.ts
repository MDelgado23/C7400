import { getCurrentUser, subscribeToUser } from '../auth/authService';
import { trackError } from '../observability/observability';
import {
  DEFAULT_THEME_PREFERENCE,
  parseThemePreference,
  type ThemePreference,
} from './themePreference';

/**
 * Theme port — where the user's choice of theme lives, and how it travels.
 *
 * Sixth port in the same shape as `observability`, `remoteConfig`, `authService`,
 * `favoritesService` and `sponsorsCache`: call sites depend on THIS module and
 * the vendors arrive through adapters registered once at boot.
 *
 * IT IS THE ONLY PORT WITH TWO STORES, and the reason is the whole feature. The
 * user asked for the choice to survive on the phone AND to follow the account,
 * and those are two different jobs with two different failure modes:
 *
 * - THE DEVICE (AsyncStorage) is about the FIRST FRAME. It is read before the
 *   splash lifts, so the app opens already wearing the right theme. Without it
 *   every cold boot would flash dark and then repaint, because the network
 *   cannot answer that fast — and on a phone with no signal it never answers.
 *
 * - THE ACCOUNT (Firestore) is about the SECOND PHONE. It is the value that
 *   followed the person here, so once it reports, IT WINS. The device copy is a
 *   cache of it, not a rival to it, and every account report is mirrored back
 *   down so the next cold boot starts from the right place.
 *
 * The exception to "the account wins" is an account with NOTHING in it. Empty
 * means "never chosen", not "chosen dark" — so it does not overwrite a choice
 * made on this device. It gets SEEDED from it instead, which is what carries a
 * preference set before registering onto the phone bought afterwards.
 *
 * WRITES ARE FIRE-AND-FORGET, for the same reason as favourites: offline, the
 * account write can legitimately stay in flight for hours. Nothing in the UI may
 * wait on it. The theme is on screen the instant it is tapped and it stays
 * there; a rejected write is reported, never surfaced, and never reverted.
 */

export type { ThemePreference } from './themePreference';

/** Local, per-device storage. Deliberately tiny, and unaware of what it holds. */
export interface ThemeStore {
  /** The stored preference, unvalidated. */
  read(): Promise<unknown>;
  write(preference: ThemePreference): Promise<void>;
}

/** Per-account storage, live. Same shape as the favourites provider. */
export interface ThemeSyncProvider {
  /** The account's preference, unvalidated, whenever it changes. Returns an unsubscribe. */
  subscribe(uid: string, listener: (raw: unknown) => void): () => void;
  write(uid: string, preference: ThemePreference): Promise<void>;
}

type ThemeListener = (preference: ThemePreference) => void;

let store: ThemeStore | null = null;
let syncProvider: ThemeSyncProvider | null = null;
let authUnsubscribe: (() => void) | null = null;
let syncUnsubscribe: (() => void) | null = null;

/**
 * The uid currently being watched.
 *
 * THREE states, exactly as in `favoritesService`: a uid, `null` for "nobody is
 * signed in", `undefined` for "we have not looked yet". Collapsing the last two
 * makes the no-change guard swallow the very first call.
 */
let watchedUid: string | null | undefined = undefined;

/** What the app is wearing right now. Never null — something has to be painted. */
let preference: ThemePreference = DEFAULT_THEME_PREFERENCE;

/**
 * What this device has EXPLICITLY stored, as opposed to what it is defaulting to.
 *
 * `null` means "this device never chose", and that is the fact the account
 * seeding turns on: writing the default upwards would turn "no preference" into
 * a preference, after which automatic could never be inherited from elsewhere.
 */
let devicePreference: ThemePreference | null = null;

/**
 * Whether the account has reported a real value for the session being watched.
 *
 * Guards the one ordering that would otherwise go wrong: the account answering
 * from the Firestore cache BEFORE the slower AsyncStorage read resolves, and the
 * device value then landing on top of the value that should have won.
 */
let accountSpoke = false;

/**
 * Whether the device has been consulted.
 *
 * The splash holds on this. Revealing before it is known means showing the
 * default and repainting a beat later, which is the exact flash the device cache
 * exists to prevent. It is never "false forever": an unreadable disk and a
 * missing adapter both settle it.
 */
let hydrated = false;

const listeners = new Set<ThemeListener>();

/**
 * Registers the device store. Called once at boot, and BEFORE the sync provider:
 * the sync provider settles hydration on its own when no store is registered, so
 * the other order would briefly declare the app hydrated on the default.
 */
export function setThemeStore(next: ThemeStore): void {
  store = next;
  void hydrateFromDevice();
}

/** Registers the account store and starts following the signed-in user. */
export function setThemeSyncProvider(next: ThemeSyncProvider): void {
  syncProvider = next;
  authUnsubscribe?.();
  authUnsubscribe = subscribeToUser((user) => watch(user?.uid ?? null));
  // `subscribeToUser` only replays a user it already has; when auth has not
  // reported yet this is a no-op and the callback above does the work later.
  watch(getCurrentUser()?.uid ?? null);
  // With no device store there is nothing to wait for, and waiting is waiting
  // for good.
  if (store === null) markHydrated();
}

/** Test hook — drops both adapters, every subscription and the cached choice. */
export function __resetTheme(): void {
  syncUnsubscribe?.();
  authUnsubscribe?.();
  syncUnsubscribe = null;
  authUnsubscribe = null;
  store = null;
  syncProvider = null;
  watchedUid = undefined;
  preference = DEFAULT_THEME_PREFERENCE;
  devicePreference = null;
  accountSpoke = false;
  hydrated = false;
  listeners.clear();
}

/**
 * Reads the choice saved on this device.
 *
 * EVERY failure here has the same right answer: carry on with the default. A
 * disk that cannot be read, bytes written by a build that spelled the values
 * differently, a record an OS-killed app left half-written — none of them are
 * worth holding the splash over, and none of them are worth a report either,
 * because the app goes on doing exactly what it was asked to.
 */
async function hydrateFromDevice(): Promise<void> {
  const source = store;
  if (source === null) {
    markHydrated();
    return;
  }

  let raw: unknown = null;
  try {
    raw = await source.read();
  } catch {
    // Indistinguishable from an empty disk, as far as what happens next goes.
  }

  const stored = parseThemePreference(raw);
  if (stored !== null) {
    devicePreference = stored;
    // The account speaks for the person, the device speaks for the phone. If the
    // account already answered, it keeps the screen.
    if (!accountSpoke) preference = stored;
  }
  markHydrated();
}

/** Settles the splash and tells everyone where things landed. */
function markHydrated(): void {
  hydrated = true;
  publish();
}

/**
 * Points the port at one account.
 *
 * The theme deliberately does NOT reset between users the way favourites does.
 * Favourites are private to a person; a colour scheme is what the phone in your
 * hand looks like, and blanking it back to dark the instant somebody signs out
 * is a repaint nobody asked for.
 */
function watch(uid: string | null): void {
  if (uid === watchedUid) return;

  syncUnsubscribe?.();
  syncUnsubscribe = null;
  watchedUid = uid;
  accountSpoke = false;

  if (uid === null || syncProvider === null) return;

  const provider = syncProvider;
  const forUid = uid;
  syncUnsubscribe = provider.subscribe(forUid, (raw) => {
    // The subscription we just cancelled can still deliver one last payload.
    // Accepting it would put the previous person's theme on this person's
    // screen.
    if (watchedUid !== forUid) return;

    const fromAccount = parseThemePreference(raw);
    if (fromAccount === null) {
      seedAccount(provider, forUid);
      return;
    }

    accountSpoke = true;
    adopt(fromAccount);
    // Mirrored down so the NEXT cold boot opens on it without waiting for the
    // network. This is what stops a second phone flashing dark on every launch.
    rememberOnDevice(fromAccount);
  });
}

/**
 * Pushes this device's choice up to an account that has none.
 *
 * The case: somebody set the theme while anonymous and then registered. Their
 * account is empty, so nothing would ever reach the phone they buy next unless
 * we put it there. Runs at most once per account — after this write the account
 * has a value and reports it like any other.
 */
function seedAccount(provider: ThemeSyncProvider, uid: string): void {
  if (devicePreference === null) return;
  provider.write(uid, devicePreference).catch(reportWriteFailure('theme.seedAccount'));
}

/** Records a preference and fans it out. Identical values are dropped. */
function adopt(next: ThemePreference): void {
  if (next === preference) return;
  preference = next;
  publish();
}

function publish(): void {
  for (const listener of listeners) notify(listener, preference);
}

/** Delivers to one listener without letting it take the others down. */
function notify(listener: ThemeListener, next: ThemePreference): void {
  try {
    listener(next);
  } catch {
    // A subscriber's bug is a subscriber's problem.
  }
}

/**
 * Reports a write that ultimately failed.
 *
 * Not shown to the user: the theme they picked is already on screen and staying
 * there, and there is nothing for them to do about a rejected sync. It is still
 * worth a report — a systematic failure here means the security rules are wrong
 * and NOBODY's preference is reaching the server, which is invisible from
 * inside the app.
 */
function reportWriteFailure(context: string): (error: unknown) => void {
  return (error) => trackError(error, context);
}

/** Best-effort local copy of a preference. */
function rememberOnDevice(next: ThemePreference): void {
  devicePreference = next;
  store?.write(next).catch(reportWriteFailure('theme.writeDevice'));
}

/** The chosen preference. Synchronous — safe to read during render. */
export function getThemePreference(): ThemePreference {
  return preference;
}

/**
 * Whether the device has been consulted.
 *
 * `getThemePreference()` answers the default until this is true, and the two
 * cases look identical from outside. The splash needs the difference: revealing
 * early means a visible repaint a beat later.
 */
export function hasHydratedTheme(): boolean {
  return hydrated;
}

/** Subscribes to the choice. Late subscribers are told the current one at once. */
export function subscribeToTheme(listener: ThemeListener): () => void {
  listeners.add(listener);
  notify(listener, preference);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Records the user's choice — on screen now, on both stores afterwards.
 *
 * Does not throw and does not await. A theme with nobody signed in is a perfectly
 * ordinary state (the anonymous session may not be up yet), and it simply skips
 * the half that has nowhere to go.
 */
export function setThemePreference(next: ThemePreference): void {
  adopt(next);
  rememberOnDevice(next);

  const uid = getCurrentUser()?.uid;
  if (uid === undefined || syncProvider === null) return;
  syncProvider.write(uid, next).catch(reportWriteFailure('theme.writeAccount'));
}
