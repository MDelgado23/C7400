import { isSameLocalDay, localDateKey, raffleWeekAt } from './raffleWeek';

/**
 * Chance economy — PURE rules for how a listener earns entries in the weekly
 * draw. No storage, no network: this decides WHETHER a grant is allowed, so the
 * same rules can be evaluated by the Cloud Function that actually writes them.
 *
 * The ledger carries the day and week it belongs to, and every entry point
 * rolls it forward to `nowMs` before reading it (see `ledgerAt`). Counters that
 * are scoped to a period but cannot say WHICH period they belong to are only
 * correct until the clock crosses a boundary, and the reset then has to be
 * bolted onto whichever user action happens to run next — which makes the rules
 * depend on the order of unrelated taps.
 *
 * SECURITY NOTE: nothing here is a security boundary. The client runs these to
 * render an honest UI ("ya hiciste el check-in de hoy"), but a client can lie
 * about anything. The ledger is server-authoritative — a chance has real value,
 * so the only numbers that count are the ones a Cloud Function wrote after
 * verifying an AdMob server-side callback signature.
 */

export interface ChanceRules {
  /** Chances granted by the free daily check-in. */
  checkInChances: number;
  /** Chances granted per verified rewarded ad. */
  adChances: number;
  /**
   * Maximum rewarded ads that can be redeemed in one local day. Caps both the
   * value of a compromised account and how hard the free path is outrun.
   */
  dailyAdCap: number;
}

/**
 * Starting economy. Belongs in remote config, NOT the binary: the station will
 * want to tune the draw (double chances for a special week, a lower cap if
 * abuse shows up) without shipping a build and waiting on store review — the
 * same reason the stream URL is not hardcoded. See `src/core/config`.
 */
export const DEFAULT_CHANCE_RULES: ChanceRules = {
  checkInChances: 1,
  adChances: 1,
  dailyAdCap: 5,
};

/** A listener's progress. Stamped with the period each counter belongs to. */
export interface ChanceLedger {
  /** Raffle week these chances belong to — a `RaffleWeek.id`. */
  weekId: string;
  /** Chances held for `weekId`. Written by the server only. */
  total: number;
  /** When the last free check-in was granted, or undefined if never. */
  lastCheckInAt?: number;
  /** Local day `adsRedeemedToday` belongs to — a `localDateKey`. */
  adsDayKey: string;
  /** Rewarded ads already redeemed during `adsDayKey`. */
  adsRedeemedToday: number;
}

/** PURE. An empty ledger for a listener starting at `nowMs`. */
export function newLedger(nowMs: number): ChanceLedger {
  return {
    weekId: raffleWeekAt(nowMs).id,
    total: 0,
    adsDayKey: localDateKey(nowMs),
    adsRedeemedToday: 0,
  };
}

/**
 * PURE. A stored ledger as it stands at `nowMs`: the daily ad allowance starts
 * over when the local day changes, and the running total starts over when the
 * raffle week does, since entries do not carry between draws.
 *
 * Every read and every grant goes through this, so expiry never depends on the
 * listener happening to perform some other action first. Returns the input
 * unchanged when nothing has rolled over.
 */
export function ledgerAt(ledger: ChanceLedger, nowMs: number): ChanceLedger {
  const weekId = raffleWeekAt(nowMs).id;
  const adsDayKey = localDateKey(nowMs);
  const sameWeek = ledger.weekId === weekId;
  const sameDay = ledger.adsDayKey === adsDayKey;
  if (sameWeek && sameDay) return ledger;
  return {
    ...ledger,
    weekId,
    total: sameWeek ? ledger.total : 0,
    adsDayKey,
    adsRedeemedToday: sameDay ? ledger.adsRedeemedToday : 0,
  };
}

/**
 * PURE. Whether the free daily check-in is available. The check-in is the path
 * that requires no ads at all — the alternative route that keeps participation
 * genuinely optional.
 */
export function canCheckIn(ledger: ChanceLedger, nowMs: number): boolean {
  const { lastCheckInAt } = ledgerAt(ledger, nowMs);
  if (lastCheckInAt === undefined) return true;
  return !isSameLocalDay(lastCheckInAt, nowMs);
}

/** PURE. Rewarded ads still redeemable today. Never negative. */
export function adsRemainingToday(
  ledger: ChanceLedger,
  rules: ChanceRules,
  nowMs: number,
): number {
  // max() guards a cap lowered from remote config while a listener is mid-day.
  return Math.max(0, rules.dailyAdCap - ledgerAt(ledger, nowMs).adsRedeemedToday);
}

/** PURE. Whether watching another rewarded ad would currently grant anything. */
export function canWatchAdForChance(
  ledger: ChanceLedger,
  rules: ChanceRules,
  nowMs: number,
): boolean {
  return adsRemainingToday(ledger, rules, nowMs) > 0;
}

/**
 * PURE. The ledger after a granted check-in, rolled forward to `nowMs`. When
 * the check-in is not due the ledger comes back unchanged apart from that roll
 * forward, so a double tap cannot double-count.
 */
export function applyCheckIn(
  ledger: ChanceLedger,
  rules: ChanceRules,
  nowMs: number,
): ChanceLedger {
  const current = ledgerAt(ledger, nowMs);
  if (!canCheckIn(current, nowMs)) return current;
  return {
    ...current,
    total: current.total + rules.checkInChances,
    lastCheckInAt: nowMs,
  };
}

/**
 * PURE. The ledger after a rewarded ad is credited, rolled forward to `nowMs`.
 * Comes back with the grant withheld once the daily cap is reached.
 */
export function applyAdReward(
  ledger: ChanceLedger,
  rules: ChanceRules,
  nowMs: number,
): ChanceLedger {
  const current = ledgerAt(ledger, nowMs);
  if (!canWatchAdForChance(current, rules, nowMs)) return current;
  return {
    ...current,
    total: current.total + rules.adChances,
    adsRedeemedToday: current.adsRedeemedToday + 1,
  };
}
