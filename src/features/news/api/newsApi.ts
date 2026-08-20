import { loadRemoteConfig } from '../../../core/config/remoteConfig';
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
export async function fetchNews(skip = 0): Promise<NewsItem[]> {
  const { newsApiBase, siteBase } = await loadRemoteConfig();
  // Omitted for the first page rather than sent as zero: the shorter URL is
  // what the CDN already has cached for everybody else opening the app.
  const query = skip > 0 ? `?skip=${skip}` : '';
  const res = await fetch(`${newsApiBase}/article${query}`);
  if (!res.ok) throw new Error(`news request failed: HTTP ${res.status}`);
  const payload = (await res.json()) as TadevelArticleResponse;
  return parseArticleList(payload, siteBase);
}

/** Fetches a single article (with body) from Tadevel's detail endpoint. */
export async function fetchArticle(id: string): Promise<ArticleDetail> {
  const { newsApiBase, siteBase } = await loadRemoteConfig();
  const res = await fetch(`${newsApiBase}/article/${id}`);
  if (!res.ok) throw new Error(`article request failed: HTTP ${res.status}`);
  const raw = (await res.json()) as TadevelArticle;
  return mapArticleDetail(raw, siteBase);
}
