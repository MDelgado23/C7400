/**
 * Raffle calendar — PURE time arithmetic for the weekly draw.
 *
 * A weekly raffle only works if everyone agrees on when the week starts and
 * ends. Computed in UTC, a listener in Azul at 21:30 on Sunday would already be
 * in next week's draw, so every boundary here is resolved in Argentina local
 * time and the offset lives in exactly one place.
 *
 * These functions take `nowMs` rather than reading the clock so the boundaries
 * are testable, and so the server (which is authoritative for the ledger) can
 * evaluate the exact same rules against its own trusted clock.
 */

/**
 * Argentina is UTC-3 and has observed no DST since 2009, so a fixed offset is
 * correct today and avoids depending on Hermes' partial Intl time-zone support.
 * If DST ever returns, THIS is the single constant to revisit.
 */
export const AR_UTC_OFFSET_MINUTES = -180;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const WEEK_MS = 7 * DAY_MS;
const OFFSET_MS = AR_UTC_OFFSET_MINUTES * MINUTE_MS;

export interface RaffleWeek {
  /**
   * Stable identifier, and the natural Firestore document key: the local date
   * of the week's Monday, as `YYYY-MM-DD`.
   *
   * Deliberately NOT the ISO week number (`2026-W34`): ISO's week-1 rules make
   * the last days of December belong to the next year's week 1, which is a
   * classic source of off-by-one-year bugs. A date has no such edge cases, and
   * it sorts correctly as a string.
   */
  id: string;
  /** Start of the week, inclusive (epoch ms) — Monday 00:00 Argentina time. */
  startsAt: number;
  /** End of the week, EXCLUSIVE (epoch ms) — the next Monday 00:00. */
  endsAt: number;
}

/** Shifts an instant into "local wall clock" space for calendar reads. */
function toLocalClock(ms: number): Date {
  return new Date(ms + OFFSET_MS);
}

function formatDate(local: Date): string {
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** PURE. Start of the local day containing `ms`, as an epoch timestamp. */
export function startOfLocalDay(ms: number): number {
  const local = toLocalClock(ms);
  const midnightLocal = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  return midnightLocal - OFFSET_MS;
}

/** PURE. The local calendar date of `ms`, as `YYYY-MM-DD`. */
export function localDateKey(ms: number): string {
  return formatDate(toLocalClock(ms));
}

/**
 * PURE. The raffle week containing `ms`. Weeks run Monday 00:00 through the
 * following Monday 00:00, Argentina local time.
 */
export function raffleWeekAt(ms: number): RaffleWeek {
  const local = toLocalClock(ms);
  // getUTCDay is 0=Sunday..6=Saturday; shift so Monday is 0.
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const mondayLocal = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday,
  );
  const startsAt = mondayLocal - OFFSET_MS;
  return {
    id: formatDate(new Date(mondayLocal)),
    startsAt,
    endsAt: startsAt + WEEK_MS,
  };
}

/** PURE. Whether `ms` falls inside `week` (start inclusive, end exclusive). */
export function isWithinWeek(week: RaffleWeek, ms: number): boolean {
  return ms >= week.startsAt && ms < week.endsAt;
}

/** PURE. Whether two instants fall on the same local calendar day. */
export function isSameLocalDay(a: number, b: number): boolean {
  return startOfLocalDay(a) === startOfLocalDay(b);
}
