import { REVALIDATE_MIN_INTERVAL_MS, shouldRevalidate } from '../revalidation';

const MINUTE = 60_000;
const NOW = 1_800_000_000_000;

function ask(input: { lastCheckedAt: number | null; now?: number; minIntervalMs?: number }): boolean {
  return shouldRevalidate({
    lastCheckedAt: input.lastCheckedAt,
    now: input.now ?? NOW,
    minIntervalMs: input.minIntervalMs ?? REVALIDATE_MIN_INTERVAL_MS,
  });
}

describe('shouldRevalidate', () => {
  // No cache yet: there is nothing on screen, so there is nothing to protect
  // and every reason to go and look.
  it('revalidates when nothing has ever been fetched', () => {
    expect(ask({ lastCheckedAt: null })).toBe(true);
  });

  it('does not revalidate again right after a check', () => {
    expect(ask({ lastCheckedAt: NOW })).toBe(false);
  });

  it('does not revalidate while inside the interval', () => {
    expect(ask({ lastCheckedAt: NOW - 29 * MINUTE, minIntervalMs: 30 * MINUTE })).toBe(false);
  });

  it('revalidates once the interval has passed', () => {
    expect(ask({ lastCheckedAt: NOW - 31 * MINUTE, minIntervalMs: 30 * MINUTE })).toBe(true);
  });

  it('revalidates exactly at the interval rather than one tick later', () => {
    expect(ask({ lastCheckedAt: NOW - 30 * MINUTE, minIntervalMs: 30 * MINUTE })).toBe(true);
  });

  // Device clocks move: a timezone change, a manual correction, an NTP sync
  // after a flat battery. A stored timestamp in the FUTURE makes the elapsed
  // time negative, and a naive comparison would then refuse to revalidate for
  // as long as the skew lasts — the section would freeze on stale data with
  // nothing on screen to explain why.
  it('revalidates when the stored timestamp is in the future', () => {
    expect(ask({ lastCheckedAt: NOW + 5 * MINUTE })).toBe(true);
  });

  it('revalidates when the clock has jumped years ahead', () => {
    expect(ask({ lastCheckedAt: NOW + 365 * 24 * 60 * MINUTE })).toBe(true);
  });

  // Neither of these can be reasoned about, and refusing to revalidate on one
  // would strand the section for the whole session.
  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('revalidates when the stored timestamp is %s', (_label, lastCheckedAt) => {
    expect(ask({ lastCheckedAt })).toBe(true);
  });
});

describe('REVALIDATE_MIN_INTERVAL_MS', () => {
  // A radio app is left open for hours, so coming back from the background is a
  // real moment to check — but not one worth a request every time somebody
  // glances at the screen.
  it('is thirty minutes', () => {
    expect(REVALIDATE_MIN_INTERVAL_MS).toBe(30 * MINUTE);
  });
});
