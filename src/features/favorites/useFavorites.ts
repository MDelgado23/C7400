import { useEffect, useState } from 'react';
import {
  getFavorites,
  hasLoadedFavorites,
  subscribeToFavorites,
  type SavedArticle,
} from '../../core/favorites/favoritesService';

interface FavoritesState {
  articles: SavedArticle[];
  /** False while the list is still on its way. See `hasLoadedFavorites`. */
  loaded: boolean;
}

/**
 * The signed-in user's saved articles, kept in sync with the favourites port.
 *
 * Seeded from the port rather than from an empty list: by the time a screen
 * mounts the Firestore cache has usually delivered already, and starting empty
 * would flash "no guardaste nada" over articles that are right there.
 */
export function useFavorites(): FavoritesState {
  const [state, setState] = useState<FavoritesState>(() => ({
    articles: getFavorites(),
    loaded: hasLoadedFavorites(),
  }));

  useEffect(
    () =>
      subscribeToFavorites((articles) => {
        setState({ articles, loaded: hasLoadedFavorites() });
      }),
    [],
  );

  return state;
}

/**
 * The saved copy of one article, or `undefined`.
 *
 * This is what makes a saved article readable with no signal: the body travelled
 * with it, so the reader never has to go back to the network for it.
 */
export function useSavedArticle(articleId: string): SavedArticle | undefined {
  return useFavorites().articles.find((article) => article.id === articleId);
}

/** Whether an article is saved. Drives the bookmark. */
export function useIsSaved(articleId: string): boolean {
  return useSavedArticle(articleId) !== undefined;
}
