import {
  reconnectDecision,
  reconnectStrategy,
  MAX_RECONNECT_ATTEMPTS,
} from '../reconnectPolicy';

describe('reconnectDecision (pure exponential backoff)', () => {
  it('retries the first drop after the base delay (1s)', () => {
    expect(reconnectDecision(0)).toEqual({ shouldRetry: true, delayMs: 1000 });
  });

  it('doubles the delay on each subsequent attempt', () => {
    expect(reconnectDecision(1).delayMs).toBe(2000);
    expect(reconnectDecision(2).delayMs).toBe(4000);
    expect(reconnectDecision(3).delayMs).toBe(8000);
    expect(reconnectDecision(4).delayMs).toBe(16000);
  });

  it('caps the delay at 30s so backoff never runs away', () => {
    const d = reconnectDecision(5);
    expect(d.shouldRetry).toBe(true);
    expect(d.delayMs).toBe(30000);
    expect(reconnectDecision(6).delayMs).toBe(30000);
  });

  it('still retries on the last allowed attempt', () => {
    expect(reconnectDecision(MAX_RECONNECT_ATTEMPTS - 1).shouldRetry).toBe(true);
  });

  it('gives up once the max attempts are exhausted', () => {
    expect(reconnectDecision(MAX_RECONNECT_ATTEMPTS)).toEqual({
      shouldRetry: false,
      delayMs: 0,
    });
  });
});

describe('reconnectStrategy (network-aware, pure)', () => {
  const online = { isConnected: true, isInternetReachable: true };
  const offline = { isConnected: false, isInternetReachable: false };

  it('waits for network instead of burning attempts when offline', () => {
    // The screen-off WiFi drop: retrying on a timer is pointless with no route.
    expect(reconnectStrategy(0, offline)).toEqual({ kind: 'await-network' });
    expect(reconnectStrategy(5, offline)).toEqual({ kind: 'await-network' });
  });

  it('treats "connected but no internet yet" as offline (still connecting)', () => {
    expect(
      reconnectStrategy(0, { isConnected: true, isInternetReachable: false }),
    ).toEqual({ kind: 'await-network' });
  });

  it('does NOT block when internet reachability is unknown (null)', () => {
    // Many devices report null reachability — fall back to timed backoff.
    expect(
      reconnectStrategy(0, { isConnected: true, isInternetReachable: null }),
    ).toEqual({ kind: 'backoff', delayMs: 1000 });
  });

  it('backs off with the exponential delay when online but the stream failed', () => {
    expect(reconnectStrategy(0, online)).toEqual({ kind: 'backoff', delayMs: 1000 });
    expect(reconnectStrategy(3, online)).toEqual({ kind: 'backoff', delayMs: 8000 });
  });

  it('gives up only when online AND attempts are exhausted', () => {
    expect(reconnectStrategy(MAX_RECONNECT_ATTEMPTS, online)).toEqual({
      kind: 'give-up',
    });
  });

  it('never gives up while offline — a dead network is not a failed retry', () => {
    expect(reconnectStrategy(MAX_RECONNECT_ATTEMPTS, offline)).toEqual({
      kind: 'await-network',
    });
  });
});
