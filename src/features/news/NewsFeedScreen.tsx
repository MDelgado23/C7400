import { useQuery } from '@tanstack/react-query';
import { fetchNews } from './api/newsApi';
import { NewsFeedView, resolveFeedStatus } from './NewsFeedView';
import type { NewsItem } from './newsMapping';

interface NewsFeedScreenProps {
  onSelectArticle: (item: NewsItem) => void;
}

/**
 * Container for the Noticias tab. TanStack Query owns fetching, caching and
 * retry; we only translate its state into a FeedStatus for the presentational
 * view (loading/error/empty/ready).
 */
export function NewsFeedScreen({ onSelectArticle }: NewsFeedScreenProps) {
  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ['news'],
    queryFn: fetchNews,
  });

  const status = resolveFeedStatus({
    isLoading,
    isError,
    count: data?.length ?? 0,
  });

  return (
    <NewsFeedView
      status={status}
      items={data ?? []}
      onRetry={() => {
        void refetch();
      }}
      onSelectArticle={onSelectArticle}
      // `isRefetching` and not `isFetching`: the first load is already covered
      // by the loading state, and showing the spinner twice for it would put a
      // pull-to-refresh indicator over a screen nobody pulled.
      refreshing={isRefetching}
      onRefresh={() => {
        void refetch();
      }}
    />
  );
}
