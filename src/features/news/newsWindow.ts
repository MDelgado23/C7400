import type { NewsItem } from './newsMapping';

/**
 * How far back the feed reaches — PURE.
 *
 * THE FEED ENDS, AND THAT IS THE DESIGN. It is not an endless scroll that keeps
 * pulling pages until the phone gives up: it carries a WEEK, and when the week
 * is covered it says so. Anything older stays reachable through the notes the
 * reader chose to save, which already store their own body and open with no
 * signal at all.
 *
 * The reason is not tidiness, it is data. The API pages twenty notes at a time
 * and has no date filter, so a week costs eleven requests and 1.2 MB — measured,
 * not guessed. Paying that up front, on every launch, on mobile data, to read
 * one note, would be charging the listener for something they did not ask for.
 * So the pages arrive as the reader scrolls, and stop at the edge of the week.
 */

/** The API's page size. Fixed: no parameter moves it — verified against the host. */
export const NEWS_PAGE_SIZE = 20;

/** How far back the feed reaches. About 180 notes at the station's usual rate. */
export const NEWS_WINDOW_DAYS = 7;

const DAY = 24 * 3600_000;

/**
 * PURE. Whether a note is recent enough to belong in the feed.
 *
 * A DATE THAT CANNOT BE READ COUNTS AS INSIDE. Hiding a note over a broken
 * timestamp would lose real content to fix a cosmetic problem — the card
 * already knows to leave out a time it cannot show. This also keeps a single
 * malformed row from being mistaken for the end of the week and taking every
 * note after it off the screen.
 */
export function isWithinWindow(
  publishedAt: string,
  now: number,
  days: number = NEWS_WINDOW_DAYS,
): boolean {
  const published = Date.parse(publishedAt);
  if (!Number.isFinite(published)) return true;
  return now - published <= days * DAY;
}

/**
 * PURE. The notes of a feed that fall inside the window.
 *
 * Cuts at the first note past the edge rather than filtering the whole list,
 * because the feed arrives newest-first: that note is where the week ends, and
 * everything after it is older still. Filtering instead would let a stray
 * out-of-order row pull older news back into a list that claims to be a week.
 */
export function trimToWindow(items: NewsItem[], now: number): NewsItem[] {
  const edge = items.findIndex((item) => !isWithinWindow(item.publishedAt, now));
  return edge === -1 ? items : items.slice(0, edge);
}

interface NextSkipInput {
  /** The page that just arrived, untrimmed. */
  lastPage: NewsItem[];
  /** How many pages have been fetched, this one included. */
  pageCount: number;
  now: number;
}

/**
 * PURE. Where the next page starts, or undefined when there is no next page.
 *
 * Three ways the feed ends, and all three matter:
 *
 *   1. THE WEEK IS COVERED. The last note of the page is past the edge, so the
 *      next page would be entirely older. Usually the boundary falls in the
 *      MIDDLE of a page: that page is kept whole and simply is not followed.
 *   2. THE PAGE CAME BACK SHORT. The API has nothing more to give, whatever the
 *      dates say. Asking again would fetch the same nothing forever.
 *   3. THE PAGE CAME BACK EMPTY. Same, one step further along.
 *
 * The skip counts RAW pages, not trimmed notes: trimming is a display decision
 * and letting it feed back into the offset would make the two drift apart and
 * start skipping notes.
 */
export function nextSkip({ lastPage, pageCount, now }: NextSkipInput): number | undefined {
  if (lastPage.length < NEWS_PAGE_SIZE) return undefined;

  const oldest = lastPage[lastPage.length - 1];
  if (oldest !== undefined && !isWithinWindow(oldest.publishedAt, now)) return undefined;

  return pageCount * NEWS_PAGE_SIZE;
}
