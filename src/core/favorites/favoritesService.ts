import { getCurrentUser, subscribeToUser } from '../auth/authService';
import { toSavedArticle, type SavedArticle } from './savedArticle';
import { trackError } from '../observability/observability';
import type { ArticleDetail } from '../../features/news/newsMapping';

/**
 * Favourites port — provider-agnostic saved articles, per user.
 *
 * Third port in the same shape as `observability`, `remoteConfig` and
 * `authService`: call sites depend on THIS module and the vendor arrives through
 * an adapter registered once at boot.
 *
 * TWO THINGS MAKE THIS ONE DIFFERENT.
 *
 * 1. IT FOLLOWS THE SIGNED-IN USER, and that is a privacy boundary rather than a
 *    refresh. When the uid changes the cached list is emptied SYNCHRONOUSLY,
 *    before anything is fetched for the new user, so there is never a frame in
 *    which one person's saved articles are on another person's screen.
 *
 * 2. WRITES ARE FIRE-AND-FORGET. With offline persistence a write can legitimately
 *    stay in flight for hours, until the phone finds signal again — so no part of
 *    the UI may wait on it. What the user sees comes from the LISTENER, which the
 *    provider fires from the local cache immediately. Reading "guardar" as an
 *    operation to await would hang a spinner forever in precisely the situation
 *    the feature was built for.
 *
 * A tap on "Guardar" with nobody signed in is still an error, and it throws:
 * that one has a person waiting on the answer.
 */

/** Re-exported so call sites need only know about the port. */
export type { SavedArticle } from './savedArticle';

/** What a storage provider must implement. Deliberately tiny. */
export interface FavoritesProvider {
  save(uid: string, article: SavedArticle): Promise<void>;
  remove(uid: string, articleId: string): Promise<void>;
  /** Live list for one user. Returns an unsubscribe. */
  subscribe(uid: string, listener: (articles: SavedArticle[]) => void): () => void;
}

type FavoritesListener = (articles: SavedArticle[]) => void;

let provider: FavoritesProvider | null = null;
let authUnsubscribe: (() => void) | null = null;
let providerUnsubscribe: (() => void) | null = null;
/**
 * The uid currently being watched.
 *
 * THREE states, and conflating the last two is a bug: a uid, `null` for "nobody
 * is signed in", and `undefined` for "we have not looked yet". With `null` doing
 * both jobs, the no-change guard in `watch` swallows the very first call and the
 * list is never marked as loaded.
 */
let watchedUid: string | null | undefined = undefined;
let favorites: SavedArticle[] = [];
/**
 * Whether the provider has reported for the uid currently being watched.
 *
 * `favorites` is empty both while the list is still coming and when the user
 * genuinely has nothing saved. Without this flag a screen cannot tell those
 * apart, and every visit flashes "no guardaste nada" before the list lands.
 */
let loaded = false;
const listeners = new Set<FavoritesListener>();

/** Register the storage adapter. Called once at boot. */
export function setFavoritesProvider(next: FavoritesProvider): void {
  __resetFavorites();
  provider = next;
  authUnsubscribe = subscribeToUser((user) => watch(user?.uid ?? null));
  // `subscribeToUser` only replays a user it already has; when auth has not
  // reported yet this is a no-op and the callback above does the work later.
  watch(getCurrentUser()?.uid ?? null);
}

/** Test hook — drops the provider, the subscriptions and the cached list. */
export function __resetFavorites(): void {
  providerUnsubscribe?.();
  authUnsubscribe?.();
  providerUnsubscribe = null;
  authUnsubscribe = null;
  provider = null;
  watchedUid = undefined;
  favorites = [];
  loaded = false;
  listeners.clear();
}

/**
 * Points the port at one user's list.
 *
 * The order matters. The previous subscription is torn down and the list
 * emptied BEFORE the new one opens, so nothing from the outgoing user can still
 * be on screen while the incoming user's articles load.
 */
function watch(uid: string | null): void {
  if (uid === watchedUid) return;

  providerUnsubscribe?.();
  providerUnsubscribe = null;
  watchedUid = uid;
  // With nobody signed in there is nothing to wait for: the answer is already
  // known and final. Calling that "loading" would spin forever on a device
  // whose anonymous session never came up.
  loaded = uid === null;
  publish([]);

  if (uid === null || provider === null) return;

  const forUid = uid;
  providerUnsubscribe = provider.subscribe(forUid, (articles) => {
    // The subscription we just cancelled can still deliver one last payload.
    // Accepting it would put the previous user's articles back on screen.
    if (watchedUid !== forUid) return;
    loaded = true;
    publish(articles);
  });
}

/**
 * Records a list and fans it out, newest first.
 *
 * The ordering is guaranteed HERE rather than left to the provider's query, so
 * it holds for every adapter — and so a row repaired with no timestamp sinks to
 * the bottom instead of leading the list.
 */
function publish(articles: SavedArticle[]): void {
  favorites = [...articles].sort((a, b) => b.savedAt - a.savedAt);
  for (const listener of listeners) notify(listener, favorites);
}

/** Delivers to one listener without letting it take the others down. */
function notify(listener: FavoritesListener, articles: SavedArticle[]): void {
  try {
    listener(articles);
  } catch {
    // A subscriber's bug is a subscriber's problem.
  }
}

/** The saved articles, newest first. Synchronous — safe to read during render. */
export function getFavorites(): SavedArticle[] {
  return favorites;
}

/**
 * Whether an article is saved. Synchronous on purpose: the bookmark renders on
 * every article and cannot await anything.
 */
export function isSaved(articleId: string): boolean {
  return favorites.some((article) => article.id === articleId);
}

/**
 * Whether the current user's list has arrived.
 *
 * An empty `getFavorites()` means "nothing saved" only once this is true; until
 * then it means "not in yet". Screens need the difference to avoid showing an
 * empty state over a list that is still on its way.
 */
export function hasLoadedFavorites(): boolean {
  return loaded;
}

/** Subscribes to the list. Late subscribers get what is already loaded. */
export function subscribeToFavorites(listener: FavoritesListener): () => void {
  listeners.add(listener);
  notify(listener, favorites);
  return () => {
    listeners.delete(listener);
  };
}

/** The provider and the uid to write under, or an error naming what is missing. */
function requireTarget(): { provider: FavoritesProvider; uid: string } {
  const uid = getCurrentUser()?.uid;
  if (provider === null || uid === undefined) {
    throw new Error('favorites unavailable: no storage provider or no signed-in user');
  }
  return { provider, uid };
}

/**
 * Reports a write that ultimately failed.
 *
 * Not shown to the user: there is nothing to do about a rejected sync, and
 * Firestore rolls the local change back on its own, so the bookmark corrects
 * itself. It is still worth a report — a systematic failure here means the
 * security rules are wrong and NOBODY's saves are reaching the server, which is
 * invisible from the app.
 */
function reportWriteFailure(context: string): (error: unknown) => void {
  return (error) => trackError(error, context);
}

/**
 * Saves an article for the signed-in user, body included.
 *
 * Works for an ANONYMOUS session too — that is the point of anonymous-first.
 * The sign-up prompt exists to make the list survive a reinstall, not to permit
 * saving in the first place.
 *
 * Throws only when there is nobody to save for. Everything after that is
 * fire-and-forget; see the note at the top of this file.
 */
export function saveArticle(article: ArticleDetail): void {
  const { provider: store, uid } = requireTarget();
  store.save(uid, toSavedArticle(article, Date.now())).catch(reportWriteFailure('favorites.save'));
}

/** Removes an article from the signed-in user's list. */
export function removeArticle(articleId: string): void {
  const { provider: store, uid } = requireTarget();
  store.remove(uid, articleId).catch(reportWriteFailure('favorites.remove'));
}
