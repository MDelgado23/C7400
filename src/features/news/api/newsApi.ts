import { loadRemoteConfig } from '../../../core/config/remoteConfig';
import { parseCategories, type NewsCategory } from '../newsCategories';
import {
  mapArticleDetail,
  parseArticleList,
  type ArticleDetail,
  type NewsItem,
  type TadevelArticle,
  type TadevelArticleResponse,
} from '../newsMapping';

/**
 * Fetches a page of the LU32 news feed from Tadevel's article API. Thin impure
 * glue: the base URL comes from remote config and the transform is the pure
 * `parseArticleList`. Throws on a non-OK response so TanStack Query can surface
 * the error state.
 *
 * PAGING IS `?skip=N`, AND ONLY THAT — verified against the live host. Three
 * things about this API are worth knowing before touching it:
 *
 *   - The `nextCursor` in the response body is a RED HERRING. It decodes to the
 *     timestamp of the page's oldest note, and no parameter accepts it: two
 *     dozen names were tried and every one returned page one again.
 *   - The page size is fixed at twenty. `take`, `limit`, `size`, `perPage` and
 *     the rest are ignored.
 *   - There is NO date filter, which is why a time window has to be enforced on
 *     this side — see `newsWindow`.
 */
export async function fetchNews(skip = 0, categoryId?: string): Promise<NewsItem[]> {
  const { newsApiBase, siteBase } = await loadRemoteConfig();

  const params = new URLSearchParams();
  // Omitted for the first page rather than sent as zero: the shorter URL is
  // what the CDN already has cached for everybody else opening the app.
  if (skip > 0) params.set('skip', String(skip));
  // The ID, never the name: filtering by name answers HTTP 500.
  if (categoryId !== undefined && categoryId.trim().length > 0) {
    params.set('category', categoryId.trim());
  }
  const query = params.toString();

  const res = await fetch(`${newsApiBase}/article${query.length > 0 ? `?${query}` : ''}`);
  if (!res.ok) throw new Error(`news request failed: HTTP ${res.status}`);
  const payload = (await res.json()) as TadevelArticleResponse;
  return parseArticleList(payload, siteBase);
}

/**
 * The sections the newsroom files notes under.
 *
 * NEVER THROWS, and that is the difference between this and `fetchNews`. The
 * chips are decoration around the feed: if the list cannot be read they simply
 * do not appear, and the news itself is unaffected. Surfacing an error state
 * for them would put a retry button over a screen that is working.
 */
export async function fetchCategories(): Promise<NewsCategory[]> {
  try {
    const { newsApiBase } = await loadRemoteConfig();
    const res = await fetch(`${newsApiBase}/category`);
    if (!res.ok) return [];
    return parseCategories(await res.json());
  } catch {
    return [];
  }
}

/** Fetches a single article (with body) from Tadevel's detail endpoint. */
export async function fetchArticle(id: string): Promise<ArticleDetail> {
  const { newsApiBase, siteBase } = await loadRemoteConfig();
  const res = await fetch(`${newsApiBase}/article/${id}`);
  if (!res.ok) throw new Error(`article request failed: HTTP ${res.status}`);
  const raw = (await res.json()) as TadevelArticle;
  return mapArticleDetail(raw, siteBase);
}
