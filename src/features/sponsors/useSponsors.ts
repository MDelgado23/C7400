import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { fetchSponsors } from './api/sponsorsApi';
import { resolveSponsorsStatus, type SponsorsStatus } from './sponsorsStatus';
import { readSnapshot, writeSnapshot } from '../../core/sponsors/sponsorsCache';
import { REVALIDATE_MIN_INTERVAL_MS, shouldRevalidate } from '../../core/sponsors/revalidation';
import type { Sponsor } from '../../core/sponsors/sponsor';

/**
 * The sponsors, served from the phone and revalidated behind it.
 *
 * STALE-WHILE-REVALIDATE, in three steps:
 *
 *   1. read the cache and draw it — no spinner, no network, works in a tunnel;
 *   2. ask, conditionally, whether the document changed;
 *   3. a 304 costs an empty body and changes nothing on screen; a 200 replaces
 *      what is shown and what is stored; a failure changes NOTHING AT ALL.
 *
 * WHY THIS IS NOT TanStack QUERY, which the news feed does use. Three things
 * here are the wrong shape for it: the cache is on disk and read
 * asynchronously, so there is no synchronous `initialData` to seed a query
 * with; freshness is decided by an HTTP validator rather than by elapsed time;
 * and the second trigger is an `AppState` transition. Bending the library
 * around all three would be more code than the hook, and would bury the one
 * property that matters — that a failed request is invisible.
 */

export interface SponsorsState {
  status: SponsorsStatus;
  sponsors: Sponsor[];
  /** Re-runs the fetch. Only reachable from the error state. */
  retry: () => void;
}

export function useSponsors(): SponsorsState {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [failed, setFailed] = useState(false);

  // Refs, not state: these steer the NEXT request and must be readable from a
  // callback that was created on an earlier render — an AppState listener
  // registered once at mount would otherwise keep asking with the first etag it
  // ever saw, and every conditional request would miss.
  const etag = useRef<string | null>(null);
  const lastCheckedAt = useRef<number | null>(null);
  const sponsorsRef = useRef<Sponsor[]>([]);
  const inFlight = useRef(false);
  // Nothing may touch state after the screen is gone.
  const mounted = useRef(true);

  const apply = useCallback((next: Sponsor[]) => {
    sponsorsRef.current = next;
    setSponsors(next);
  }, []);

  /**
   * Asks whether the document changed, and applies the answer.
   *
   * A FAILURE IS DELIBERATELY QUIET. Whatever is on screen stays on screen and
   * nothing is written, so a dead network is indistinguishable from a good one
   * for anybody who already has the grid. `failed` only reaches the user
   * through `resolveSponsorsStatus`, which ignores it whenever there are
   * sponsors to draw.
   */
  const revalidate = useCallback(async () => {
    // The launch fetch and an AppState transition can land together; without
    // this they would both fetch, and the slower answer would win.
    if (inFlight.current) return;
    inFlight.current = true;
    setFetching(true);
    setFailed(false);

    try {
      const result = await fetchSponsors(etag.current);
      const now = Date.now();
      lastCheckedAt.current = now;

      if (result.status === 'updated') {
        etag.current = result.etag;
        if (mounted.current) apply(result.sponsors);
        else sponsorsRef.current = result.sponsors;
      }
      // Written on a 304 as well as a 200. The bytes are identical, but the
      // TIMESTAMP is the whole point: without recording that the cache was just
      // confirmed, the interval never advances and the app re-asks on every
      // single return to the foreground.
      await writeSnapshot({
        etag: etag.current,
        sponsors: sponsorsRef.current,
        fetchedAt: now,
      });
    } catch {
      // Nothing is applied and nothing is stored — see above.
      if (mounted.current) setFailed(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setFetching(false);
    }
  }, [apply]);

  // Boot: cache first, then ask. The order is the feature.
  useEffect(() => {
    mounted.current = true;
    void (async () => {
      const cached = await readSnapshot();
      if (!mounted.current) return;
      if (cached !== null) {
        etag.current = cached.etag;
        lastCheckedAt.current = cached.fetchedAt;
        apply(cached.sponsors);
      }
      // Set before the fetch so a cached grid stops reading as "loading" the
      // moment it is on screen, rather than when the network gets back.
      setHydrated(true);
      // Unconditional on launch: this is the check the user asked for on every
      // open, and the interval only governs returns from the background.
      await revalidate();
    })();

    return () => {
      mounted.current = false;
    };
  }, [apply, revalidate]);

  // A radio app lives in the background for hours, so a return to the
  // foreground is a real moment to look — throttled, because it is also
  // something that happens dozens of times an hour.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      if (
        !shouldRevalidate({
          lastCheckedAt: lastCheckedAt.current,
          now: Date.now(),
          minIntervalMs: REVALIDATE_MIN_INTERVAL_MS,
        })
      ) {
        return;
      }
      void revalidate();
    });
    return () => subscription.remove();
  }, [revalidate]);

  const retry = useCallback(() => {
    void revalidate();
  }, [revalidate]);

  return {
    status: resolveSponsorsStatus({ hydrated, fetching, failed, count: sponsors.length }),
    sponsors,
    retry,
  };
}
