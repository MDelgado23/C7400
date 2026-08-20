/**
 * What the Auspiciantes screen should be showing — PURE.
 *
 * Four discrete states, the same vocabulary the news feed uses
 * (`resolveFeedStatus`), so the container's only job is to map what it knows
 * onto one of them and the view stays a switch.
 *
 * The order of the rules below IS the design of the section, and it is worth
 * reading in that light: this screen is served from the phone first and
 * revalidated behind it, so its states are not the states of a screen that
 * waits for a network response.
 */

export type SponsorsStatus = 'loading' | 'error' | 'empty' | 'ready';

interface StatusInput {
  /** Whether the cached snapshot has been read yet. */
  hydrated: boolean;
  /** Whether a revalidation is in flight. */
  fetching: boolean;
  /** Whether the last revalidation failed. */
  failed: boolean;
  /** How many sponsors are in hand, cached or fetched. */
  count: number;
}

/**
 * PURE. The state to render.
 *
 * HAVING SPONSORS OUTRANKS EVERYTHING. That single line is what the whole cache
 * was built for: from the second launch onward the grid is on screen before any
 * request is made, and no amount of network trouble behind it may replace a
 * working section with a spinner or an error. Airplane mode looks exactly like
 * a good connection here, which is the point.
 *
 * With nothing in hand the states separate honestly: still working on it
 * (`loading`), tried and could not (`error`), or asked and the answer is that
 * there are none (`empty`). The last two look similar and are not — one has a
 * retry worth offering and the other has nothing to retry.
 */
export function resolveSponsorsStatus({
  hydrated,
  fetching,
  failed,
  count,
}: StatusInput): SponsorsStatus {
  if (count > 0) return 'ready';
  if (!hydrated || fetching) return 'loading';
  return failed ? 'error' : 'empty';
}
