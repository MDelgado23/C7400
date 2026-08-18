import {
  loadRemoteConfig,
  getFallbackConfig,
  __resetRemoteConfigCache,
} from '../remoteConfig';

/**
 * remoteConfig is impure (fetch) but its caching contract is testable: the app
 * boots it from App.tsx while the news feed loads it again on first render, so
 * concurrent callers must share one request, not race two.
 */

const mockFetch = jest.fn();

beforeEach(() => {
  __resetRemoteConfigCache();
  mockFetch.mockReset();
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
