/**
 * When to go and ask whether the sponsors document changed — PURE.
 *
 * The section is served from the phone and revalidated behind it, so this
 * decision is never on the path between the user and the grid: saying "no"
 * costs nothing visible, and saying "yes" costs a conditional request that
 * usually comes back 304 with an empty body.
 *
 * Kept separate from the hook that calls it because the interesting cases are
 * all about time going wrong — a clock that ran backwards, a timestamp that
 * arrived as NaN — and those are miserable to reproduce through a component
 * and trivial to state here.
 */

/**
 * How long a check stays good for when the app returns from the background.
 *
 * A radio app is left open for hours, so coming back to the foreground is a
 * genuine moment to look — but not one worth a request every time somebody
 * glances at their phone. Thirty minutes is a choice, not a measurement; it
 * lives here with a name so moving it is one edit.
 */
export const REVALIDATE_MIN_INTERVAL_MS = 30 * 60_000;

interface RevalidateInput {
  /** When the document was last checked, or null if it never has been. */
  lastCheckedAt: number | null;
  now: number;
  minIntervalMs: number;
}

/**
 * PURE. Whether to issue a conditional request for the sponsors document.
 *
 * EVERY UNCERTAIN CASE ANSWERS YES, and that asymmetry is deliberate. A
 * needless request is one 304 nobody notices; a wrongly skipped one freezes the
 * section on stale data for the rest of the session, with nothing on screen to
 * explain it. So a missing timestamp, a corrupt one, or one that sits in the
 * future — a timezone change, a manual correction, an NTP sync after a flat
 * battery — all revalidate rather than being reasoned about.
 */
export function shouldRevalidate({ lastCheckedAt, now, minIntervalMs }: RevalidateInput): boolean {
  if (lastCheckedAt === null || !Number.isFinite(lastCheckedAt)) return true;

  const elapsed = now - lastCheckedAt;
  // Negative elapsed means the stored moment is in the future, which a plain
  // `elapsed >= minIntervalMs` would read as "checked very recently" and honour
  // for as long as the skew lasted.
  if (elapsed < 0) return true;

  return elapsed >= minIntervalMs;
}
