/**
 * When a note was published, as a reader would say it — PURE.
 *
 * ON A NEWS FEED, "WHEN" IS HALF THE INFORMATION. A note from twenty minutes
 * ago and one from yesterday are different kinds of news, and nothing in a
 * headline tells them apart. On a radio's app the difference is the whole
 * point: most of what makes this worth opening is that something is happening
 * now.
 *
 * Deliberately not `Intl.RelativeTimeFormat`: it is available, but it decides
 * the wording, and the wording here is the product ("recién", not "hace 0
 * minutos"). Doing the arithmetic makes every case above testable as a
 * sentence instead of a locale's opinion.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Past this, elapsed time stops being useful and the date itself is clearer. */
const CALENDAR_AFTER = 7 * DAY;

/**
 * The shape the API actually sends, checked before parsing.
 *
 * `Date.parse` is lenient in a way that is worse than failing: it reads
 * `"2026-08-"` as the first of August and hands back a perfectly valid date
 * that nobody wrote. A wrong date printed confidently on a news card is exactly
 * the silent failure this codebase spends its time removing, so anything that
 * is not at least a full YYYY-MM-DD is refused outright.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** `13 ago`, or `4 nov 2025` when the year is not the current one. */
function calendarDate(published: Date, now: Date): string {
  const day = published.getDate();
  const month = MONTHS[published.getMonth()];
  const year = published.getFullYear();
  return year === now.getFullYear() ? `${day} ${month}` : `${day} ${month} ${year}`;
}

/**
 * PURE. A short label for a publication date, or undefined when there is
 * nothing trustworthy to say.
 *
 * Returning undefined rather than a fallback string is the point: the card
 * omits the line entirely instead of printing "Fecha desconocida", which would
 * take up the same room to say nothing. The feed is built from an API response
 * that is typed and never validated, so a missing or malformed date is a real
 * possibility rather than a theoretical one.
 */
export function publishedLabel(isoDate: string, now: number): string | undefined {
  if (!ISO_DATE.test(isoDate)) return undefined;
  const published = Date.parse(isoDate);
  if (!Number.isFinite(published)) return undefined;

  // Clamped at zero: a device clock behind the server, or a note scheduled
  // ahead, would otherwise print "hace -3 min".
  const elapsed = Math.max(now - published, 0);

  if (elapsed < MINUTE) return 'recién';
  if (elapsed < HOUR) return `hace ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `hace ${Math.floor(elapsed / HOUR)} h`;
  if (elapsed < 2 * DAY) return 'ayer';
  if (elapsed < CALENDAR_AFTER) return `hace ${Math.floor(elapsed / DAY)} días`;

  return calendarDate(new Date(published), new Date(now));
}
