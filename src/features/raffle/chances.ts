import { isSameLocalDay } from './raffleWeek';

/**
 * Chance economy — PURE rules for how a listener earns entries in the weekly
 * draw. No storage, no network: this decides WHETHER a grant is allowed, so the
 * same rules can be evaluated by the Cloud Function that actually writes them.
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

/** A listener's progress within the current raffle week. */
export interface ChanceLedger {
  /** Total chances held for the current week. Written by the server only. */
  total: number;
  /** When the last free check-in was granted, or undefined if never. */
  lastCheckInAt?: number;
  /** Rewarded ads already redeemed during the current local day. */
  adsRedeemedToday: number;
}

/**
 * PURE. Whether the free daily check-in is available. The check-in is the path
 * that requires no ads at all — the alternative route that keeps participation
 * genuinely optional.
 */
export function canCheckIn(ledger: ChanceLedger, nowMs: number): boolean {
  if (ledger.lastCheckInAt === undefined) return true;
  return !isSameLocalDay(ledger.lastCheckInAt, nowMs);
}

/** PURE. Rewarded ads still redeemable today. Never negative. */
export function adsRemainingToday(ledger: ChanceLedger, rules: ChanceRules): number {
  return Math.max(0, rules.dailyAdCap - ledger.adsRedeemedToday);
}

/** PURE. Whether watching another rewarded ad would currently grant anything. */
export function canWatchAdForChance(ledger: ChanceLedger, rules: ChanceRules): boolean {
  return adsRemainingToday(ledger, rules) > 0;
}

/**
 * PURE. The ledger after a granted check-in. Returns the input untouched when
 * the check-in is not due, so a double tap cannot double-count.
 */
export function applyCheckIn(
  ledger: ChanceLedger,
  rules: ChanceRules,
  nowMs: number,
): ChanceLedger {
  if (!canCheckIn(ledger, nowMs)) return ledger;
  return {
    ...ledger,
    total: ledger.total + rules.checkInChances,
    lastCheckInAt: nowMs,
    // A check-in crossing midnight is the first action of a new local day, so
    // the daily ad allowance resets with it.
    adsRedeemedToday: isSameLocalDay(ledger.lastCheckInAt ?? nowMs, nowMs)
      ? ledger.adsRedeemedToday
      : 0,
  };
}

/**
 * PURE. The ledger after a rewarded ad is credited. Returns the input untouched
 * once the daily cap is reached.
 */
export function applyAdReward(ledger: ChanceLedger, rules: ChanceRules): ChanceLedger {
  if (!canWatchAdForChance(ledger, rules)) return ledger;
  return {
    ...ledger,
    total: ledger.total + rules.adChances,
    adsRedeemedToday: ledger.adsRedeemedToday + 1,
  };
}
