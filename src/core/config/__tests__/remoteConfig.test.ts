import {
  loadRemoteConfig,
  getFallbackConfig,
  __resetRemoteConfigCache,
} from '../remoteConfig';
import {
  setObservabilitySink,
  __resetObservability,
} from '../../observability/observability';

/**
 * remoteConfig is impure (fetch) but its caching contract is testable: the app
 * boots it from App.tsx while the news feed loads it again on first render, so
 * concurrent callers must share one request, not race two.
 */

const mockFetch = jest.fn();
const sink = { logEvent: jest.fn(), logScreen: jest.fn(), recordError: jest.fn() };

beforeEach(() => {
  __resetRemoteConfigCache();
  __resetObservability();
  mockFetch.mockReset();
  sink.logEvent.mockReset();
  setObservabilitySink(sink);
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe('loadRemoteConfig', () => {
  it('merges a valid remote override over the fallback', async () => {
    mockFetch.mockResolvedValue(
      okResponse({ streamUrl: 'https://stream.example/live' }),
    );

    const config = await loadRemoteConfig();

    expect(config.streamUrl).toBe('https://stream.example/live');
    expect(config.newsApiBase).toBe(getFallbackConfig().newsApiBase);
  });

  it('falls back silently when the fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));

    await expect(loadRemoteConfig()).resolves.toEqual(getFallbackConfig());
  });

  it('reports that it fell back, with the failure name', async () => {
    // Serving baked-in defaults is invisible from the outside: the app boots
    // fine and plays fine, right up until the stream port rotates.
    mockFetch.mockRejectedValue(new DOMException('aborted', 'AbortError'));

    await loadRemoteConfig();

    expect(sink.logEvent).toHaveBeenCalledWith('config_fallback_used', {
      reason: 'AbortError',
    });
  });

  it('says nothing when the remote config loads fine', async () => {
    mockFetch.mockResolvedValue(okResponse({}));

    await loadRemoteConfig();

    expect(sink.logEvent).not.toHaveBeenCalled();
  });

  it('shares one request between concurrent callers', async () => {
    // App.tsx boots this while the news feed loads it too; without an in-flight
    // cache both fire their own request, and on a dead network both pay the
    // full 4s timeout before the app can start.
    mockFetch.mockResolvedValue(okResponse({}));

    const [a, b] = await Promise.all([loadRemoteConfig(), loadRemoteConfig()]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('serves the resolved config from cache on later calls', async () => {
    mockFetch.mockResolvedValue(okResponse({}));

    await loadRemoteConfig();
    await loadRemoteConfig();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries after a failure once the cache is reset', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    await loadRemoteConfig();

    __resetRemoteConfigCache();
    mockFetch.mockResolvedValue(
      okResponse({ streamUrl: 'https://stream.example/live' }),
    );
    const config = await loadRemoteConfig();

    expect(config.streamUrl).toBe('https://stream.example/live');
  });
});
