import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { fetchCategories, fetchNews } from './api/newsApi';
import { NewsFeedView, resolveFeedStatus } from './NewsFeedView';
import { nextSkip, trimToWindow } from './newsWindow';
import type { NewsItem } from './newsMapping';

interface NewsFeedScreenProps {
  onSelectArticle: (item: NewsItem) => void;
}

/** The sections barely change; asking for them again every hour is plenty. */
const CATEGORIES_STALE_MS = 60 * 60_000;

/**
 * Container for the Noticias tab.
 *
 * THE FEED CARRIES A WEEK AND THEN STOPS. Not an endless scroll: pages arrive
 * as the reader scrolls and the paging ends at the edge of the window — see
 * `newsWindow` for why, and for what it costs to do otherwise.
 *
 * TanStack Query owns fetching, caching and retry; the only decisions made here
 * are WHERE the next page starts (`nextSkip`) and WHICH of the notes fetched
 * belong on screen (`trimToWindow`). Both are pure and tested apart from this.
 */
export function NewsFeedScreen({ onSelectArticle }: NewsFeedScreenProps) {
  /**
   * The section being read, or null for the whole feed.
   *
   * Deliberately NOT remembered between sessions. Somebody opening a radio's
   * app wants to know what is going on, not to resume the filter they set last
   * Tuesday — and a feed silently missing most of its news, because of a choice
   * nobody remembers making, reads as an app with nothing in it.
   */
  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Never fails: an unreadable list means no chips, and the news is unaffected.
  const { data: categories } = useQuery({
    queryKey: ['news-categories'],
    queryFn: fetchCategories,
    staleTime: CATEGORIES_STALE_MS,
  });

  const {
    data,
    isLoading,
    isError,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    // The section is part of the key, so each one keeps its own pages and
    // switching back to one already read costs nothing.
    queryKey: ['news', categoryId],
    queryFn: ({ pageParam }) => fetchNews(pageParam, categoryId ?? undefined),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      nextSkip({ lastPage, pageCount: allPages.length, now: Date.now() }),
  });

  // Trimmed at DISPLAY time, never fed back into the offset: `nextSkip` counts
  // raw pages, and letting a display decision move the offset would make the
  // two drift apart and start skipping notes.
  const items = trimToWindow(data?.pages.flat() ?? [], Date.now());

  const status = resolveFeedStatus({ isLoading, isError, count: items.length });

  return (
    <NewsFeedView
      status={status}
      items={items}
      onRetry={() => {
        void refetch();
      }}
      onSelectArticle={onSelectArticle}
      // `isRefetching` and not `isFetching`: the first load is already covered
      // by the loading state, and showing the spinner there would put a
      // pull-to-refresh indicator over a screen nobody pulled.
      refreshing={isRefetching}
      onRefresh={() => {
        void refetch();
      }}
      onEndReached={() => {
        // Guarded rather than left to the library: FlatList fires this more than
        // once around the bottom, and each extra call would be another page
        // request the reader never asked for.
        if (!hasNextPage || isFetchingNextPage) return;
        void fetchNextPage();
      }}
      loadingMore={isFetchingNextPage}
      reachedEnd={!hasNextPage && items.length > 0}
      categories={categories ?? []}
      selectedCategoryId={categoryId}
      onSelectCategory={setCategoryId}
    />
  );
}
