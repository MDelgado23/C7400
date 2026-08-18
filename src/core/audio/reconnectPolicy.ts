/**
 * Pure reconnection policy for the live stream.
 *
 * When the stream drops, the audio service consults this to decide whether to
 * auto-reconnect and how long to wait. Exponential backoff avoids hammering the
 * server; the cap keeps the delay reasonable; the attempt limit stops infinite
 * retries (after which the user retries manually from the error UI).
 */

export const MAX_RECONNECT_ATTEMPTS = 8;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

export interface ReconnectDecision {
  shouldRetry: boolean;
  delayMs: number;
}

/**
 * @param attempt zero-based count of reconnects already made.
 * @returns whether to retry and the backoff delay before doing so.
 */
export function reconnectDecision(attempt: number): ReconnectDecision {
  if (attempt >= MAX_RECONNECT_ATTEMPTS) {
    return { shouldRetry: false, delayMs: 0 };
  }
  const delayMs = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return { shouldRetry: true, delayMs };
}

/** Minimal view of expo-network's `NetworkState` this policy needs. */
export interface NetworkStateLike {
  isConnected: boolean;
  /** `null` when the OS hasn't determined reachability — treated as "maybe". */
  isInternetReachable: boolean | null;
}

/**
 * What the audio service should do after a stream drop, given how many
 * reconnects it has already tried AND whether the network is actually up.
 *
 * - `await-network`: offline → parking the retry until connectivity returns is
 *   the whole point. Burning timed attempts against a dead route (the screen-off
 *   WiFi drop) is what left the player stuck in `error`. Attempts are NOT spent.
 * - `backoff`: online but the stream/server failed → timed exponential retry.
 * - `give-up`: online and out of attempts → surface the error for a manual retry.
 */
export type ReconnectAction =
  | { kind: 'await-network' }
  | { kind: 'backoff'; delayMs: number }
  | { kind: 'give-up' };

/**
 * PURE. Reachability `false` (connected but no internet) counts as offline —
 * we are still mid-reconnect. `null` (unknown) does NOT block: we fall back to
 * timed backoff so a device that never reports reachability still recovers.
 */
export function reconnectStrategy(
  attempt: number,
  net: NetworkStateLike,
): ReconnectAction {
  const online = net.isConnected && net.isInternetReachable !== false;
  if (!online) return { kind: 'await-network' };

  const { shouldRetry, delayMs } = reconnectDecision(attempt);
  return shouldRetry ? { kind: 'backoff', delayMs } : { kind: 'give-up' };
}
