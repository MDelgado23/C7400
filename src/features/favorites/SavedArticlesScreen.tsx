import { useCallback, useState } from 'react';
import { SavedArticlesView, resolveSavedStatus } from './SavedArticlesView';
import { accountPromptFor, type AccountIntent } from './accountPrompt';
import { useFavorites } from './useFavorites';
import { AuthSheet } from '../auth/AuthSheet';
import type { AuthMode } from '../auth/authSheetState';
import { useAuthUser } from '../auth/useAuthUser';
import { removeArticle } from '../../core/favorites/favoritesService';
import type { SavedArticle } from '../../core/favorites/savedArticle';

interface SavedArticlesScreenProps {
  onSelectArticle: (article: SavedArticle) => void;
}

/**
 * Container for the saved-articles list. There is no fetching and no error
 * state: the list comes from the favourites port, which serves it from the
 * local Firestore cache and keeps it in sync in the background.
 *
 * It also carries the app's PERMANENT account entry point. The contextual sheet
 * fires once per session and only right after a save, which left anyone who
 * declined it with no route to an account at all, and left registered users
 * with nowhere to see who they were or sign out. Found on a device, not in a
 * test.
 */
export function SavedArticlesScreen({ onSelectArticle }: SavedArticlesScreenProps) {
  const { articles, loaded } = useFavorites();
  const user = useAuthUser();
  const [authVisible, setAuthVisible] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('register');

  const account = accountPromptFor(user);

  const handlePressAccount = useCallback((intent: AccountIntent) => {
    // Only the two doors reach here — signing out lives in the Cuenta tab now.
    // Straight to the form the user asked for: the row's own message already
    // made the case, and someone who tapped "Entrar" has no business landing on
    // a pitch.
    setAuthMode(intent === 'signup' ? 'register' : 'signIn');
    setAuthVisible(true);
  }, []);

  return (
    <>
      <SavedArticlesView
        status={resolveSavedStatus({ loaded, count: articles.length })}
        articles={articles}
        onSelectArticle={onSelectArticle}
        onRemove={removeArticle}
        account={account}
        onPressAccount={handlePressAccount}
      />
      <AuthSheet
        visible={authVisible}
        initialMode={authMode}
        onClose={() => setAuthVisible(false)}
      />
    </>
  );
}
