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
