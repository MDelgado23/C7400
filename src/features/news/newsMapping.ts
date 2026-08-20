import { absoluteArticleUrl } from './articleUrl';
import { pickHero, pickSquareThumb, type TadevelPhotoAsset } from './photoAsset';

/**
 * Pure mapping between Tadevel's article API and our app's NewsItem model.
 * No fetch here — kept pure so the transforms (especially image selection,
 * which must dodge Tadevel's broken `thumbnailUrl`) are unit-tested directly.
 */

export type { TadevelPhotoAsset, TadevelPhotoFile } from './photoAsset';

export interface TadevelArticle {
  id: string;
  title: string;
  deck?: string;
  kicker?: string;
  date: string;
  url?: string;
  photoAsset?: TadevelPhotoAsset | null;
  /** Broken in Tadevel's payload (`.../hostname/undefined/...`) — do not use. */
  thumbnailUrl?: string;
  /** Present only on the detail endpoint (GET /article/{id}). HTML body. */
  bodyHtml?: string;
}

export interface TadevelArticleResponse {
  data?: TadevelArticle[];
  nextCursor?: string;
  prevCursor?: string;
}

/** App-facing news feed item. */
export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  kicker?: string;
  /** Full-resolution image, for the article detail hero. */
  imageUrl?: string;
  /** The CDN's square crop, for the feed card's square box. */
  thumbUrl?: string;
  /**
   * Width over height of `imageUrl`, so the frame can be shaped like the photo
   * instead of cropping it into a fixed box. Absent when there is no photo.
   */
  imageAspectRatio?: number;
  publishedAt: string;
  webUrl?: string;
}

/** A full article: the feed item plus the readable body split into paragraphs. */
export interface ArticleDetail extends NewsItem {
  paragraphs: string[];
}

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, (m) => HTML_ENTITIES[m] ?? m);
}

/**
 * PURE: convert Tadevel's `bodyHtml` into clean text paragraphs for native
 * rendering (no HTML engine needed). `<br>` becomes newlines, tags are
 * stripped, entities decoded, and empty/whitespace paragraphs dropped.
 */
export function htmlToParagraphs(html?: string): string[] {
  if (!html) return [];
  return html
    .split(/<\/p>/i)
    .map((chunk) => chunk.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .map(decodeEntities)
    .map((text) => text.replace(/[ \t]+\n/g, '\n').trim())
    .filter((text) => text.length > 0);
}

/**
 * `siteBase` is threaded in rather than read here so this stays pure. It is
 * what turns the PATH the API calls `url` into a real address — see
 * `absoluteArticleUrl` for why that matters and what it refuses.
 */
export function mapArticle(raw: TadevelArticle, siteBase: string): NewsItem {
  const hero = pickHero(raw.photoAsset);
  return {
    id: raw.id,
    title: raw.title,
    summary: raw.deck ?? '',
    kicker: raw.kicker,
    imageUrl: hero?.url,
    imageAspectRatio: hero?.aspectRatio,
    thumbUrl: pickSquareThumb(raw.photoAsset),
    publishedAt: raw.date,
    webUrl: absoluteArticleUrl(raw.url, siteBase),
  };
}

export function parseArticleList(res: TadevelArticleResponse, siteBase: string): NewsItem[] {
  return (res.data ?? []).map((raw) => mapArticle(raw, siteBase));
}

export function mapArticleDetail(raw: TadevelArticle, siteBase: string): ArticleDetail {
  return {
    ...mapArticle(raw, siteBase),
    paragraphs: htmlToParagraphs(raw.bodyHtml),
  };
}
