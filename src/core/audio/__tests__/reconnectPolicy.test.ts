import { reconnectDecision, MAX_RECONNECT_ATTEMPTS } from '../reconnectPolicy';

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
