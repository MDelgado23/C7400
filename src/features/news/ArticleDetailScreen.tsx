import { useQuery } from '@tanstack/react-query';
import { fetchArticle } from './api/newsApi';
import { ArticleDetailView, type DetailStatus } from './ArticleDetailView';

interface ArticleDetailScreenProps {
  articleId: string;
}

/**
 * Container for a single article. TanStack Query fetches the detail (body) by
 * id; we translate its state into a DetailStatus for the presentational view.
 */
export function ArticleDetailScreen({ articleId }: ArticleDetailScreenProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['article', articleId],
    queryFn: () => fetchArticle(articleId),
  });

  const status: DetailStatus = isLoading ? 'loading' : isError || !data ? 'error' : 'ready';

  return (
    <ArticleDetailView
      status={status}
      article={data}
      onRetry={() => {
        void refetch();
      }}
    />
  );
}
