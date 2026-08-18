import {
  raffleWeekAt,
  isWithinWeek,
  isSameLocalDay,
  startOfLocalDay,
  localDateKey,
} from '../raffleWeek';

/** Argentina is UTC-3, so local midnight is 03:00 UTC the same date. */
function ar(iso: string): number {
  return Date.parse(iso);
}

describe('raffleWeekAt', () => {
  it('identifies a week by the local date of its Monday', () => {
    // Wednesday 2026-08-19, 15:00 ART.
    const week = raffleWeekAt(ar('2026-08-19T18:00:00Z'));
    expect(week.id).toBe('2026-08-17');
  });

  it('starts the week at local Monday midnight, which is 03:00 UTC', () => {
    const week = raffleWeekAt(ar('2026-08-19T18:00:00Z'));
    expect(new Date(week.startsAt).toISOString()).toBe('2026-08-17T03:00:00.000Z');
  });

  it('ends exactly seven days later, exclusive', () => {
    const week = raffleWeekAt(ar('2026-08-19T18:00:00Z'));
    expect(new Date(week.endsAt).toISOString()).toBe('2026-08-24T03:00:00.000Z');
    expect(isWithinWeek(week, week.endsAt)).toBe(false);
    expect(isWithinWeek(week, week.endsAt - 1)).toBe(true);
  });

  it('keeps Sunday night in the week that is ending, not the next one', () => {
    // 21:30 ART on Sunday is already Monday 00:30 UTC. Computed in UTC this
    // listener would be entered into next week's draw.
    const sundayNight = ar('2026-08-24T00:30:00Z'); // = Sun 2026-08-23 21:30 ART
    expect(raffleWeekAt(sundayNight).id).toBe('2026-08-17');
  });

  it('rolls over exactly at local Monday midnight', () => {
    const boundary = ar('2026-08-24T03:00:00Z'); // Mon 2026-08-24 00:00 ART
    expect(raffleWeekAt(boundary - 1).id).toBe('2026-08-17');
    expect(raffleWeekAt(boundary).id).toBe('2026-08-24');
  });

  it('treats Monday itself as the first day of its own week', () => {
    const monday = ar('2026-08-17T12:00:00Z');
    expect(raffleWeekAt(monday).id).toBe('2026-08-17');
  });

  it('does not break across a year boundary', () => {
    // The reason the id is a date and not an ISO week number: ISO would call
    // this week `2027-W01` while the calendar still says 2026.
    const newYearEve = ar('2026-12-31T15:00:00Z'); // Thu 2026-12-31 12:00 ART
    expect(raffleWeekAt(newYearEve).id).toBe('2026-12-28');
  });

  it('gives every instant in a week the same identifier', () => {
    const week = raffleWeekAt(ar('2026-08-19T18:00:00Z'));
    expect(raffleWeekAt(week.startsAt).id).toBe(week.id);
    expect(raffleWeekAt(week.endsAt - 1).id).toBe(week.id);
  });
});

describe('local day helpers', () => {
  it('resolves the start of the local day to 03:00 UTC', () => {
    const start = startOfLocalDay(ar('2026-08-19T18:00:00Z'));
    expect(new Date(start).toISOString()).toBe('2026-08-19T03:00:00.000Z');
  });

  it('keeps late-evening local time on the same local day', () => {
    // 22:00 ART Wednesday is already Thursday in UTC.
    const wednesdayNight = ar('2026-08-20T01:00:00Z');
    expect(localDateKey(wednesdayNight)).toBe('2026-08-19');
  });

  it('recognises two instants on the same local day', () => {
    expect(
      isSameLocalDay(ar('2026-08-19T09:00:00Z'), ar('2026-08-20T02:59:00Z')),
    ).toBe(true);
  });

  it('separates instants across local midnight', () => {
    expect(
      isSameLocalDay(ar('2026-08-20T02:59:00Z'), ar('2026-08-20T03:01:00Z')),
    ).toBe(false);
  });
});
