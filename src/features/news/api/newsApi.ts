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
 * Fetches the LU32 news feed from Tadevel's article API. Thin impure glue:
 * the base URL comes from remote config and the transform is the pure
 * `parseArticleList`. Throws on a non-OK response so TanStack Query can surface
 * the error state.
 */
export async function fetchNews(): Promise<NewsItem[]> {
  const { newsApiBase } = await loadRemoteConfig();
  const res = await fetch(`${newsApiBase}/article`);
  if (!res.ok) throw new Error(`news request failed: HTTP ${res.status}`);
  const payload = (await res.json()) as TadevelArticleResponse;
  return parseArticleList(payload);
}

/** Fetches a single article (with body) from Tadevel's detail endpoint. */
export async function fetchArticle(id: string): Promise<ArticleDetail> {
  const { newsApiBase } = await loadRemoteConfig();
  const res = await fetch(`${newsApiBase}/article/${id}`);
  if (!res.ok) throw new Error(`article request failed: HTTP ${res.status}`);
  const raw = (await res.json()) as TadevelArticle;
  return mapArticleDetail(raw);
}
