/**
 * Pure mapping between Tadevel's article API and our app's NewsItem model.
 * No fetch here — kept pure so the transforms (especially image selection,
 * which must dodge Tadevel's broken `thumbnailUrl`) are unit-tested directly.
 */

export interface TadevelPhotoFile {
  url: string;
  width?: number;
  height?: number;
  tag?: string;
}

export interface TadevelPhotoAsset {
  id: string;
  files: TadevelPhotoFile[];
}

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
  /** Small variant, for the feed card thumb — see `pickThumbUrl`. */
  thumbUrl?: string;
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
 * Picks the highest-resolution file from a photo asset for the full-bleed
 * article hero, ignoring the unreliable top-level `thumbnailUrl`. Returns
 * undefined when the article has no usable image.
 */
export function pickImageUrl(asset?: TadevelPhotoAsset | null): string | undefined {
  if (!asset?.files?.length) return undefined;
  const best = asset.files.reduce((a, b) => ((b.width ?? 0) > (a.width ?? 0) ? b : a));
  return best.url;
}

/**
 * Target width for feed thumbs: the card thumb is 72pt, so this covers a 3x
 * screen with headroom and still avoids pulling the full-resolution original.
 */
const THUMB_TARGET_WIDTH = 320;

/**
 * Picks the smallest file that still covers the feed thumb, falling back to the
 * largest when the asset has nothing big enough. Feeding the hero-sized image to
 * a 72pt thumb downloads megabytes per card over mobile data for no visible gain.
 */
export function pickThumbUrl(
  asset?: TadevelPhotoAsset | null,
  targetWidth: number = THUMB_TARGET_WIDTH,
): string | undefined {
  if (!asset?.files?.length) return undefined;
  const bySize = [...asset.files].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const adequate = bySize.find((file) => (file.width ?? 0) >= targetWidth);
  return (adequate ?? bySize[bySize.length - 1]).url;
}

export function mapArticle(raw: TadevelArticle): NewsItem {
  return {
    id: raw.id,
    title: raw.title,
    summary: raw.deck ?? '',
    kicker: raw.kicker,
    imageUrl: pickImageUrl(raw.photoAsset),
    thumbUrl: pickThumbUrl(raw.photoAsset),
    publishedAt: raw.date,
    webUrl: raw.url,
  };
}

export function parseArticleList(res: TadevelArticleResponse): NewsItem[] {
  return (res.data ?? []).map(mapArticle);
}

export function mapArticleDetail(raw: TadevelArticle): ArticleDetail {
  return {
    ...mapArticle(raw),
    paragraphs: htmlToParagraphs(raw.bodyHtml),
  };
}
