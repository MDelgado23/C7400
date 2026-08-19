import type { ArticleDetail } from '../../features/news/newsMapping';

/**
 * The saved-article model — PURE conversion in both directions.
 *
 * A favourite stores a SNAPSHOT, body included, not a reference. Two reasons:
 *
 * 1. People save an article to read it LATER, which on a phone usually means
 *    on a bus with no signal. A stored id would render as a spinner and then an
 *    error at precisely the moment the feature was supposed to pay off.
 * 2. Tadevel's feed is not ours. An article that rotates out of their API would
 *    turn every favourite pointing at it into a dead row.
 *
 * The cost is staleness: a headline corrected upstream stays as it was saved.
 * For a saved-for-later list that is the right trade — the user kept THAT
 * article, and a snapshot is what "kept" means.
 */

export interface SavedArticle {
  id: string;
  title: string;
  summary: string;
  kicker?: string;
  imageUrl?: string;
  thumbUrl?: string;
  publishedAt: string;
  webUrl?: string;
  paragraphs: string[];
  /** Milliseconds since epoch, from the CLIENT clock. See `toSavedArticle`. */
  savedAt: number;
  /** Present only when the body did not fit. Lets the reader be told. */
  truncated?: boolean;
}

/**
 * Character budget for the stored body.
 *
 * Firestore rejects any document over 1 MiB outright. Real articles run well
 * under 50k characters, so this never fires in practice — but when it does, the
 * user loses a headline they can still read instead of losing the save with an
 * error about a limit they have never heard of.
 */
export const MAX_BODY_CHARS = 200_000;

/** Copies `value` onto `target` under `key`, but only when it is a usable string. */
function putOptionalString(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (typeof value === 'string' && value.length > 0) target[key] = value;
}

/**
 * Trims a body to the budget on paragraph boundaries.
 *
 * Cutting mid-sentence would leave the reader staring at a word that stops. A
 * whole paragraph missing at least reads as an ending.
 */
function fitBody(paragraphs: string[]): { paragraphs: string[]; truncated: boolean } {
  let used = 0;
  const kept: string[] = [];
  for (const paragraph of paragraphs) {
    if (used + paragraph.length > MAX_BODY_CHARS) return { paragraphs: kept, truncated: true };
    kept.push(paragraph);
    used += paragraph.length;
  }
  return { paragraphs: kept, truncated: false };
}

/**
 * PURE. An article as it will be stored.
 *
 * `savedAt` is the CLIENT clock on purpose. Firestore's `serverTimestamp()` reads
 * back as `null` from the local cache until the write reaches the server, so an
 * article saved offline — the case this whole design is built around — would
 * carry an unorderable timestamp for as long as the device stays offline. Clock
 * skew between two devices can misorder a "recién guardadas" list by minutes; a
 * null cannot be ordered at all.
 *
 * Absent optional fields are OMITTED rather than set to `undefined`: Firestore
 * refuses a document containing one ("Unsupported field value: undefined"), so
 * a single article with no kicker would fail the entire save.
 */
export function toSavedArticle(article: ArticleDetail, savedAt: number): SavedArticle {
  const body = fitBody(article.paragraphs);
  const saved: Record<string, unknown> = {
    id: article.id,
    title: article.title,
    summary: article.summary,
    publishedAt: article.publishedAt,
    paragraphs: body.paragraphs,
    savedAt,
  };
  putOptionalString(saved, 'kicker', article.kicker);
  putOptionalString(saved, 'imageUrl', article.imageUrl);
  putOptionalString(saved, 'thumbUrl', article.thumbUrl);
  putOptionalString(saved, 'webUrl', article.webUrl);
  if (body.truncated) saved.truncated = true;
  return saved as unknown as SavedArticle;
}

/** Keeps only the strings out of an unknown array. */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * PURE. Rebuilds a `SavedArticle` from a stored document, or `null` when the
 * document is too broken to be one.
 *
 * Stored documents are just JSON. An older build of the app, a write that never
 * finished, or an edit in the Firebase console can all produce a row that no
 * longer matches this shape — and a list that throws on the first bad row shows
 * the user nothing at all. Anything recoverable is repaired; only a missing
 * identity or headline is fatal, because there is nothing left to show.
 */
export function fromStoredData(raw: unknown): SavedArticle | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;

  if (typeof data.id !== 'string' || data.id.length === 0) return null;
  if (typeof data.title !== 'string' || data.title.length === 0) return null;

  const recovered: Record<string, unknown> = {
    id: data.id,
    title: data.title,
    summary: typeof data.summary === 'string' ? data.summary : '',
    publishedAt: typeof data.publishedAt === 'string' ? data.publishedAt : '',
    paragraphs: toStringArray(data.paragraphs),
    // Falls back to the epoch rather than to "now": a repaired row must not
    // jump to the top of a list ordered by when things were actually saved.
    savedAt: typeof data.savedAt === 'number' && Number.isFinite(data.savedAt) ? data.savedAt : 0,
  };
  putOptionalString(recovered, 'kicker', data.kicker);
  putOptionalString(recovered, 'imageUrl', data.imageUrl);
  putOptionalString(recovered, 'thumbUrl', data.thumbUrl);
  putOptionalString(recovered, 'webUrl', data.webUrl);
  if (data.truncated === true) recovered.truncated = true;

  return recovered as unknown as SavedArticle;
}
