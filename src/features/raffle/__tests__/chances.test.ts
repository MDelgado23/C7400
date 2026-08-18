import {
  newLedger,
  ledgerAt,
  canCheckIn,
  canWatchAdForChance,
  adsRemainingToday,
  applyCheckIn,
  applyAdReward,
  DEFAULT_CHANCE_RULES,
  type ChanceLedger,
} from '../chances';

const rules = DEFAULT_CHANCE_RULES;

/** Monday 2026-08-17, 15:00 ART — the first day of its raffle week. */
const MONDAY = Date.parse('2026-08-17T18:00:00Z');
/** Wednesday 2026-08-19, 15:00 ART. */
const WEDNESDAY = Date.parse('2026-08-19T18:00:00Z');
/** Thursday 2026-08-20, 15:00 ART. */
const THURSDAY = Date.parse('2026-08-20T18:00:00Z');
/** Monday 2026-08-24, 15:00 ART — the NEXT raffle week. */
const NEXT_MONDAY = Date.parse('2026-08-24T18:00:00Z');

/** Watches `count` ads back to back at `nowMs`. */
function watchAds(ledger: ChanceLedger, count: number, nowMs: number): ChanceLedger {
  let next = ledger;
  for (let i = 0; i < count; i += 1) next = applyAdReward(next, rules, nowMs);
  return next;
}

describe('ledgerAt (rolling a stored ledger forward)', () => {
  it('leaves a ledger untouched within the same day and week', () => {
    const ledger = newLedger(WEDNESDAY);
    expect(ledgerAt(ledger, WEDNESDAY + 3600_000)).toBe(ledger);
  });

  it('clears the ad counter when the local day changes', () => {
    const spent = watchAds(newLedger(WEDNESDAY), 3, WEDNESDAY);
    expect(ledgerAt(spent, THURSDAY).adsRedeemedToday).toBe(0);
  });

  it('clears the weekly total when the raffle week changes', () => {
    const earned = applyCheckIn(newLedger(WEDNESDAY), rules, WEDNESDAY);
    expect(earned.total).toBeGreaterThan(0);
    expect(ledgerAt(earned, NEXT_MONDAY).total).toBe(0);
  });

  it('keeps the weekly total across days inside the same week', () => {
    const earned = applyCheckIn(newLedger(WEDNESDAY), rules, WEDNESDAY);
    expect(ledgerAt(earned, THURSDAY).total).toBe(earned.total);
  });
});

describe('canCheckIn', () => {
  it('allows the first check-in ever', () => {
    expect(canCheckIn(newLedger(WEDNESDAY), WEDNESDAY)).toBe(true);
  });

  it('refuses a second check-in on the same local day', () => {
    const done = applyCheckIn(newLedger(WEDNESDAY), rules, WEDNESDAY);
    expect(canCheckIn(done, WEDNESDAY + 3600_000)).toBe(false);
  });

  it('allows it again the next local day', () => {
    const done = applyCheckIn(newLedger(WEDNESDAY), rules, WEDNESDAY);
    expect(canCheckIn(done, THURSDAY)).toBe(true);
  });

  it('uses local midnight, not UTC midnight, as the boundary', () => {
    // 22:00 and 23:00 ART on Wednesday are both already Thursday in UTC.
    const early = Date.parse('2026-08-20T01:00:00Z');
    const later = Date.parse('2026-08-20T02:00:00Z');
    const done = applyCheckIn(newLedger(early), rules, early);
    expect(canCheckIn(done, later)).toBe(false);
  });
});

describe('applyCheckIn', () => {
  it('grants the configured chances and records the time', () => {
    const next = applyCheckIn(newLedger(WEDNESDAY), rules, WEDNESDAY);
    expect(next.total).toBe(rules.checkInChances);
    expect(next.lastCheckInAt).toBe(WEDNESDAY);
  });

  it('is idempotent within the same day, so a double tap cannot double-count', () => {
    const once = applyCheckIn(newLedger(WEDNESDAY), rules, WEDNESDAY);
    expect(applyCheckIn(once, rules, WEDNESDAY + 1000)).toBe(once);
  });

  it('accumulates across the days of one raffle week', () => {
    const monday = applyCheckIn(newLedger(MONDAY), rules, MONDAY);
    const wednesday = applyCheckIn(monday, rules, WEDNESDAY);
    expect(wednesday.total).toBe(rules.checkInChances * 2);
  });

  it('starts the count over in a new raffle week', () => {
    const lastWeek = applyCheckIn(newLedger(WEDNESDAY), rules, WEDNESDAY);
    const thisWeek = applyCheckIn(lastWeek, rules, NEXT_MONDAY);
    expect(thisWeek.total).toBe(rules.checkInChances);
  });
});

describe('rewarded ads', () => {
  it('reports the full allowance on a fresh day', () => {
    const ledger = newLedger(WEDNESDAY);
    expect(adsRemainingToday(ledger, rules, WEDNESDAY)).toBe(rules.dailyAdCap);
    expect(canWatchAdForChance(ledger, rules, WEDNESDAY)).toBe(true);
  });

  it('credits a chance and spends one of the day allowance', () => {
    const next = applyAdReward(newLedger(WEDNESDAY), rules, WEDNESDAY);
    expect(next.total).toBe(rules.adChances);
    expect(next.adsRedeemedToday).toBe(1);
  });

  it('stops crediting once the daily cap is reached', () => {
    const capped = watchAds(newLedger(WEDNESDAY), rules.dailyAdCap, WEDNESDAY);
    expect(canWatchAdForChance(capped, rules, WEDNESDAY)).toBe(false);
    expect(applyAdReward(capped, rules, WEDNESDAY).total).toBe(capped.total);
  });

  it('grants a fresh allowance the next day WITHOUT needing a check-in', () => {
    // The cap must expire on its own. Tying the reset to the check-in locked a
    // capped listener out for the whole of the next day if they went straight
    // to an ad instead of tapping check-in first.
    const capped = watchAds(newLedger(WEDNESDAY), rules.dailyAdCap, WEDNESDAY);
    expect(adsRemainingToday(capped, rules, THURSDAY)).toBe(rules.dailyAdCap);
    expect(canWatchAdForChance(capped, rules, THURSDAY)).toBe(true);
  });

  it('cannot be stretched past the cap by delaying the check-in', () => {
    // The economic bypass: with the reset living inside applyCheckIn, watching
    // ads BEFORE checking in on a new day let the same allowance be spent
    // twice — 8 ads credited against a cap of 5.
    const monday = watchAds(applyCheckIn(newLedger(MONDAY), rules, MONDAY), 2, MONDAY);

    const beforeCheckIn = watchAds(monday, 5, WEDNESDAY);
    const afterCheckIn = applyCheckIn(beforeCheckIn, rules, WEDNESDAY);
    const stretched = watchAds(afterCheckIn, 5, WEDNESDAY);

    expect(stretched.adsRedeemedToday).toBe(rules.dailyAdCap);
  });

  it('resets a stale ad count for a listener who never checked in', () => {
    // Ads watched on a fresh install with no check-in yet still belong to that
    // day, and must not follow the listener into the next one.
    const neverCheckedIn = watchAds(newLedger(WEDNESDAY), rules.dailyAdCap, WEDNESDAY);
    expect(neverCheckedIn.lastCheckInAt).toBeUndefined();

    const nextDay = applyCheckIn(neverCheckedIn, rules, THURSDAY);

    expect(nextDay.adsRedeemedToday).toBe(0);
    expect(adsRemainingToday(nextDay, rules, THURSDAY)).toBe(rules.dailyAdCap);
  });

  it('never reports a negative allowance if the cap was lowered mid-day', () => {
    const spent = watchAds(newLedger(WEDNESDAY), 5, WEDNESDAY);
    const tighter = { ...rules, dailyAdCap: 2 };
    expect(adsRemainingToday(spent, tighter, WEDNESDAY)).toBe(0);
  });

  it('keeps the free path available once the ad cap is spent', () => {
    // This is what keeps watching ads genuinely optional.
    const capped = watchAds(newLedger(WEDNESDAY), rules.dailyAdCap, WEDNESDAY);
    expect(canCheckIn(capped, WEDNESDAY)).toBe(true);
  });
});
