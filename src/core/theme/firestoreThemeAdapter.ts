import { getFirestore, doc, setDoc, onSnapshot } from '@react-native-firebase/firestore';
import { trackError } from '../observability/observability';
import type { ThemePreference } from './themePreference';
import type { ThemeSyncProvider } from './themeService';

/**
 * Firestore adapter for the theme port — the account's copy of the choice.
 *
 * The second module that imports Firestore, alongside the favourites adapter,
 * and it is deliberately the same shape: a live subscription per uid, writes
 * handed straight back unguarded, and the vendor visible nowhere else.
 *
 * WHY A LIVE SUBSCRIPTION rather than a one-off read at sign-in: offline
 * persistence means `onSnapshot` fires from the local cache IMMEDIATELY, so the
 * cheap case costs nothing — and the expensive case, someone changing the theme
 * on their other phone, arrives on this one without anybody reopening the app.
 * A one-off read would give up the second half for no saving on the first.
 *
 * Layout: `users/{uid}/settings/preferences`, ONE document holding the account's
 * settings rather than a document per setting. A theme is a handful of bytes; a
 * document per setting would multiply the reads, the listeners and the rules for
 * nothing. The next preference is a field in here, not a sibling collection.
 */

const USERS = 'users';
const SETTINGS = 'settings';
/** The one settings document. Fixed id, so there is nothing to look up first. */
const PREFERENCES = 'preferences';

/** The field inside the document. Named for what it holds, not for the feature. */
const THEME_FIELD = 'theme';

function preferencesDoc(uid: string) {
  return doc(getFirestore(), USERS, uid, SETTINGS, PREFERENCES);
}

export const firestoreThemeProvider: ThemeSyncProvider = {
  /**
   * Writes the theme, LEAVING THE REST OF THE DOCUMENT ALONE.
   *
   * `merge: true` is not a nicety here, it is the whole contract of a shared
   * settings document: a plain `setDoc` replaces it, so the day a second
   * preference lands beside this one, saving the theme would silently delete it.
   *
   * The promise is handed straight back, unguarded. Offline it may not settle
   * for hours, and that is fine: the port attaches its own catch and never makes
   * the UI wait on it.
   */
  write(uid: string, preference: ThemePreference): Promise<void> {
    return setDoc(preferencesDoc(uid), { [THEME_FIELD]: preference }, { merge: true });
  },

  subscribe(uid: string, listener: (raw: unknown) => void): () => void {
    return onSnapshot(
      preferencesDoc(uid),
      (snapshot) => {
        // An account that never saved anything has NO document, and that is a
        // real answer rather than a failure — it means "never chosen", which is
        // what lets the port seed it from this device instead of overwriting.
        listener(snapshot.exists() ? snapshot.data()?.[THEME_FIELD] : undefined);
      },
      (error) => {
        // A failed listener simply STOPS delivering — the theme freezes at
        // whatever the device had and nothing anywhere says why. The likely
        // cause is a rules change denying reads, which is invisible from inside
        // the app and affects everyone at once.
        trackError(error, 'theme.subscribe');
      },
    );
  },
};
