import {
  canCheckIn,
  canWatchAdForChance,
  adsRemainingToday,
  applyCheckIn,
  applyAdReward,
  DEFAULT_CHANCE_RULES,
  type ChanceLedger,
} from '../chances';

const rules = DEFAULT_CHANCE_RULES;

/** Wednesday 2026-08-19, 15:00 ART. */
const WEDNESDAY = Date.parse('2026-08-19T18:00:00Z');
/** Thursday 2026-08-20, 15:00 ART. */
const THURSDAY = Date.parse('2026-08-20T18:00:00Z');

function ledger(overrides: Partial<ChanceLedger> = {}): ChanceLedger {
  return { total: 0, adsRedeemedToday: 0, ...overrides };
}

describe('canCheckIn', () => {
  it('allows the first check-in ever', () => {
    expect(canCheckIn(ledger(), WEDNESDAY)).toBe(true);
  });

  it('refuses a second check-in on the same local day', () => {
    expect(canCheckIn(ledger({ lastCheckInAt: WEDNESDAY }), WEDNESDAY + 3600_000)).toBe(
      false,
    );
  });

  it('allows it again the next local day', () => {
    expect(canCheckIn(ledger({ lastCheckInAt: WEDNESDAY }), THURSDAY)).toBe(true);
  });

  it('uses local midnight, not UTC midnight, as the boundary', () => {
    // 22:00 ART Wednesday and 23:00 ART Wednesday are both already Thursday UTC.
    const early = Date.parse('2026-08-20T01:00:00Z');
    const later = Date.parse('2026-08-20T02:00:00Z');
    expect(canCheckIn(ledger({ lastCheckInAt: early }), later)).toBe(false);
  });
});

describe('applyCheckIn', () => {
  it('grants the configured chances and records the time', () => {
    const next = applyCheckIn(ledger(), rules, WEDNESDAY);
    expect(next.total).toBe(rules.checkInChances);
    expect(next.lastCheckInAt).toBe(WEDNESDAY);
  });

  it('is idempotent within the same day, so a double tap cannot double-count', () => {
    const once = applyCheckIn(ledger(), rules, WEDNESDAY);
    const twice = applyCheckIn(once, rules, WEDNESDAY + 1000);
    expect(twice).toBe(once);
  });

  it('resets the daily ad allowance when the day rolls over', () => {
    const spent = ledger({ lastCheckInAt: WEDNESDAY, adsRedeemedToday: 5 });
    expect(applyCheckIn(spent, rules, THURSDAY).adsRedeemedToday).toBe(0);
  });
});

describe('rewarded ads', () => {
  it('reports the full allowance on a fresh day', () => {
    expect(adsRemainingToday(ledger(), rules)).toBe(rules.dailyAdCap);
    expect(canWatchAdForChance(ledger(), rules)).toBe(true);
  });

  it('credits a chance and spends one of the day allowance', () => {
    const next = applyAdReward(ledger(), rules);
    expect(next.total).toBe(rules.adChances);
    expect(next.adsRedeemedToday).toBe(1);
  });

  it('stops crediting once the daily cap is reached', () => {
    const capped = ledger({ adsRedeemedToday: rules.dailyAdCap, total: 5 });
    expect(canWatchAdForChance(capped, rules)).toBe(false);
    expect(applyAdReward(capped, rules)).toBe(capped);
  });

  it('never reports a negative allowance if the server recorded more than the cap', () => {
    // The cap can be lowered from remote config while a listener is mid-day.
    const overspent = ledger({ adsRedeemedToday: rules.dailyAdCap + 3 });
    expect(adsRemainingToday(overspent, rules)).toBe(0);
  });

  it('keeps the free path independent of the ad cap', () => {
    // The check-in must stay available even with ads exhausted — it is the
    // route that makes watching ads genuinely optional.
    const capped = ledger({ adsRedeemedToday: rules.dailyAdCap });
    expect(canCheckIn(capped, WEDNESDAY)).toBe(true);
  });
});
