import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from '@react-native-firebase/firestore';
import { fromStoredData, type SavedArticle } from './savedArticle';
import { trackError } from '../observability/observability';
import type { FavoritesProvider } from './favoritesService';

/**
 * Firestore adapter for the favourites port.
 *
 * The ONLY module in the app that imports Firestore. Everything else calls the
 * port, so moving to another store means replacing this file and the one line
 * that registers it.
 *
 * WHY FIRESTORE and not something we hand-roll: offline persistence is on by
 * default on Android and iOS. A save with no signal lands in the local cache,
 * the listener fires from that cache immediately, and the write syncs whenever
 * the phone next sees the network. For a radio app used on mobile data — saving
 * a note to read on the bus — that behaviour IS the feature, and it costs us
 * nothing.
 *
 * Layout: `users/{uid}/favorites/{articleId}`. The article id is the DOCUMENT
 * id, which makes saving the same article twice idempotent rather than leaving
 * two rows, and makes removal a direct delete with nothing to look up first.
 * Nesting under the uid is also what lets the security rules be one line — see
 * `firestore.rules`.
 */

const USERS = 'users';
const FAVORITES = 'favorites';

function favoritesCollection(uid: string) {
  return collection(getFirestore(), USERS, uid, FAVORITES);
}

function favoriteDoc(uid: string, articleId: string) {
  return doc(getFirestore(), USERS, uid, FAVORITES, articleId);
}

export const firestoreFavoritesProvider: FavoritesProvider = {
  save(uid: string, article: SavedArticle): Promise<void> {
    // The promise is handed straight back, unguarded. Offline it may not settle
    // for hours, and that is fine: the port attaches its own catch and never
    // makes the UI wait on it.
    return setDoc(favoriteDoc(uid, article.id), article);
  },

  remove(uid: string, articleId: string): Promise<void> {
    return deleteDoc(favoriteDoc(uid, articleId));
  },

  subscribe(uid: string, listener: (articles: SavedArticle[]) => void): () => void {
    // Ordered here as well as in the port: it costs nothing, and it means the
    // very first cached payload already arrives in the right order.
    const savedNewestFirst = query(favoritesCollection(uid), orderBy('savedAt', 'desc'));

    return onSnapshot(
      savedNewestFirst,
      (snapshot) => {
        const articles: SavedArticle[] = [];
        for (const document of snapshot.docs) {
          // Every row is validated on the way in. Stored documents are just
          // JSON, and one written by an older build would otherwise take the
          // whole list down with it.
          const article = fromStoredData(document.data());
          if (article !== null) articles.push(article);
        }
        listener(articles);
      },
      (error) => {
        // A failed listener simply STOPS delivering — the list freezes at
        // whatever it last showed and nothing anywhere says why. The likely
        // cause is a rules change denying reads, which is invisible from inside
        // the app and affects everyone at once.
        trackError(error, 'favorites.subscribe');
      },
    );
  },
};
