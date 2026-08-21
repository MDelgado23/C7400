import { publishedLabel } from '../publishedLabel';

/** A fixed "now" so nothing here depends on when the suite runs. */
const NOW = Date.parse('2026-08-20T21:30:00.000Z');

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The label for something published `ago` milliseconds before NOW. */
function agoBy(ago: number): string | undefined {
  return publishedLabel(new Date(NOW - ago).toISOString(), NOW);
}

describe('publishedLabel', () => {
  // On a radio's feed, "when" is half the information: a note from twenty
  // minutes ago and one from yesterday are different kinds of news, and the
  // reader cannot tell them apart from the headline alone.
  describe('within the hour', () => {
    it('says just now for something published seconds ago', () => {
      expect(agoBy(20_000)).toBe('recién');
    });

    it.each([
      [1, 'hace 1 min'],
      [5, 'hace 5 min'],
      [59, 'hace 59 min'],
    ])('says %i minutes as "%s"', (minutes, expected) => {
      expect(agoBy(minutes * MINUTE)).toBe(expected);
    });
  });

  describe('within the day', () => {
    it.each([
      [1, 'hace 1 h'],
      [3, 'hace 3 h'],
      [23, 'hace 23 h'],
    ])('says %i hours as "%s"', (hours, expected) => {
      expect(agoBy(hours * HOUR)).toBe(expected);
    });
  });

  describe('further back', () => {
    it('says yesterday for the day before', () => {
      expect(agoBy(DAY + HOUR)).toBe('ayer');
    });

    it.each([
      [2, 'hace 2 días'],
      [6, 'hace 6 días'],
    ])('says %i days as "%s"', (days, expected) => {
      expect(agoBy(days * DAY)).toBe(expected);
    });

    // Past a week the elapsed time stops meaning anything useful and the date
    // itself is the more honest answer. The feed only carries a week, but a
    // SAVED article can be months old and shows the same label.
    it('gives the date once a week has passed', () => {
      expect(publishedLabel('2026-08-13T10:00:00.000Z', NOW)).toBe('13 ago');
    });

    it('adds the year when it is not the current one', () => {
      expect(publishedLabel('2025-11-04T10:00:00.000Z', NOW)).toBe('4 nov 2025');
    });
  });

  describe('times that make no sense', () => {
    // A device clock behind the server, or a note scheduled ahead. Reading it
    // as a negative elapsed time would print "hace -3 min".
    it('treats a date in the future as just now', () => {
      expect(agoBy(-5 * MINUTE)).toBe('recién');
    });

    // Nothing to show beats something wrong: the card simply omits the line.
    it.each([
      ['empty', ''],
      ['not a date', 'ayer nomás'],
      ['half an ISO string', '2026-08-'],
    ])('returns nothing for %s', (_label, value) => {
      expect(publishedLabel(value, NOW)).toBeUndefined();
    });
  });
});
