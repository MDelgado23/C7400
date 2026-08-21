import {
  NEWS_PAGE_SIZE,
  NEWS_WINDOW_DAYS,
  isWithinWindow,
  nextSkip,
  trimToWindow,
} from '../newsWindow';
import type { NewsItem } from '../newsMapping';

const NOW = Date.parse('2026-08-20T21:00:00.000Z');
const DAY = 24 * 3600_000;

/** A note published `daysAgo` days before NOW. */
function note(id: string, daysAgo: number): NewsItem {
  return {
    id,
    title: `Nota ${id}`,
    summary: '',
    publishedAt: new Date(NOW - daysAgo * DAY).toISOString(),
  };
}

/** A full page of notes, all `daysAgo` days old. */
function page(daysAgo: number, size = NEWS_PAGE_SIZE): NewsItem[] {
  return Array.from({ length: size }, (_, i) => note(`d${daysAgo}-${i}`, daysAgo));
}

describe('isWithinWindow', () => {
  it.each([0, 1, 3, 6.9])('keeps a note from %s days ago', (days) => {
    expect(isWithinWindow(note('x', days).publishedAt, NOW)).toBe(true);
  });

  it.each([7.1, 10, 400])('leaves out a note from %s days ago', (days) => {
    expect(isWithinWindow(note('x', days).publishedAt, NOW)).toBe(false);
  });

  // A note whose date cannot be read is still a note. Hiding it over a bad
  // timestamp would lose real content to fix a cosmetic problem — the card
  // already knows to omit the time it cannot show.
  it.each([
    ['empty', ''],
    ['nonsense', 'anteayer'],
  ])('keeps a note whose date is %s', (_label, publishedAt) => {
    expect(isWithinWindow(publishedAt, NOW)).toBe(true);
  });

  it('carries a week', () => {
    expect(NEWS_WINDOW_DAYS).toBe(7);
  });
});

describe('trimToWindow', () => {
  it('keeps everything when the whole page is inside the week', () => {
    const items = [note('a', 0), note('b', 2), note('c', 6)];

    expect(trimToWindow(items, NOW)).toEqual(items);
  });

  // The feed arrives newest-first, so the first note past the edge marks where
  // the week ends — everything after it is older still.
  it('cuts at the first note older than the week', () => {
    const items = [note('a', 1), note('b', 6), note('c', 8), note('d', 9)];

    expect(trimToWindow(items, NOW).map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('returns nothing when even the newest note is past the edge', () => {
    expect(trimToWindow([note('a', 30), note('b', 31)], NOW)).toEqual([]);
  });

  it('survives an empty list', () => {
    expect(trimToWindow([], NOW)).toEqual([]);
  });

  // An unreadable date must not be mistaken for the end of the week and take
  // every note after it off the screen.
  it('does not stop at a note whose date cannot be read', () => {
    const broken = { ...note('b', 1), publishedAt: 'cuando sea' };
    const items = [note('a', 1), broken, note('c', 2)];

    expect(trimToWindow(items, NOW).map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('nextSkip', () => {
  // THE WHOLE POINT: the feed ends. It is not an endless scroll that keeps
  // pulling until the phone gives up — a week is the promise, and once the week
  // is covered there is nothing left to ask for.
  it('stops once the last note of the page is past the week', () => {
    expect(nextSkip({ lastPage: page(8), pageCount: 11, now: NOW })).toBeUndefined();
  });

  it('asks for the page after this one while still inside the week', () => {
    expect(nextSkip({ lastPage: page(2), pageCount: 3, now: NOW })).toBe(3 * NEWS_PAGE_SIZE);
  });

  it('counts from the very first page', () => {
    expect(nextSkip({ lastPage: page(0), pageCount: 1, now: NOW })).toBe(NEWS_PAGE_SIZE);
  });

  // A short page means the API has nothing more to give, whatever the dates
  // say. Asking again would fetch the same nothing forever.
  it('stops on a page that came back short', () => {
    expect(nextSkip({ lastPage: page(1, 7), pageCount: 2, now: NOW })).toBeUndefined();
  });

  it('stops on an empty page', () => {
    expect(nextSkip({ lastPage: [], pageCount: 2, now: NOW })).toBeUndefined();
  });

  // The boundary usually falls in the MIDDLE of a page: the page is kept, and
  // this is the last one asked for.
  it('stops when the page straddles the edge of the week', () => {
    const straddling = [...page(6, 10), ...page(8, 10)];

    expect(nextSkip({ lastPage: straddling, pageCount: 5, now: NOW })).toBeUndefined();
  });

  // An unreadable date at the end of a page must not be read as "the week is
  // over" and cut the feed short.
  it('keeps going when the last note of the page has no usable date', () => {
    const withBrokenTail = [...page(1, 19), { ...note('x', 1), publishedAt: '' }];

    expect(nextSkip({ lastPage: withBrokenTail, pageCount: 1, now: NOW })).toBe(NEWS_PAGE_SIZE);
  });
});
