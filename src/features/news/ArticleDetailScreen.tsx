import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchArticle } from './api/newsApi';
import { ArticleDetailView, type DetailStatus } from './ArticleDetailView';
import { AuthSheet } from '../auth/AuthSheet';
import { useAuthUser } from '../auth/useAuthUser';
import { useSavedArticle } from '../favorites/useFavorites';
import { shouldPromptSignup } from '../favorites/signupPrompt';
import { saveArticle, removeArticle } from '../../core/favorites/favoritesService';
import { trackError } from '../../core/observability/observability';

interface ArticleDetailScreenProps {
  articleId: string;
}

/**
 * Container for a single article.
 *
 * A SAVED COPY WINS OVER THE NETWORK. The saved snapshot carries the body, so
 * rendering it means the article opens instantly and works with no signal —
 * which is the entire reason the body is stored in the first place. The trade is
 * staleness: a headline corrected upstream stays as it was saved. That is the
 * right way round, because the user kept THAT article.
 *
 * The fetch is disabled while a saved copy exists, so opening a saved note costs
 * no data at all.
 */
export function ArticleDetailScreen({ articleId }: ArticleDetailScreenProps) {
  const user = useAuthUser();
  const savedCopy = useSavedArticle(articleId);
  const [authVisible, setAuthVisible] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['article', articleId],
    queryFn: () => fetchArticle(articleId),
    enabled: savedCopy === undefined,
  });

  // `data` is kept as a fallback rather than dropped: removing an article while
  // reading it must not blank the screen the user is looking at.
  const article = savedCopy ?? data;
  const status: DetailStatus = article ? 'ready' : isLoading ? 'loading' : 'error';

  const handleToggleSave = useCallback(() => {
    if (savedCopy !== undefined) {
      removeArticle(articleId);
      return;
    }
    if (article === undefined) return;

    try {
      saveArticle(article);
    } catch (error) {
      // Only thrown when there is no session at all — the anonymous sign-in
      // failed at boot. Offering the sheet turns a dead button into the one
      // action that actually fixes it.
      trackError(error, 'articleDetail.save');
      setAuthVisible(true);
      return;
    }

    // Asked once per session, and only right after a save, when "no lo pierdas
    // si cambiás de celular" is about an article they just chose to keep.
    if (shouldPromptSignup(user?.isAnonymous ?? false)) setAuthVisible(true);
  }, [savedCopy, article, articleId, user]);

  return (
    <>
      <ArticleDetailView
        status={status}
        article={article}
        onRetry={() => {
          void refetch();
        }}
        isSaved={savedCopy !== undefined}
        onToggleSave={handleToggleSave}
      />
      <AuthSheet visible={authVisible} onClose={() => setAuthVisible(false)} />
    </>
  );
}
