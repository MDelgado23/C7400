import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSponsors } from '../useSponsors';
import { asyncStorageSponsorsStore } from '../../../core/sponsors/asyncStorageSponsorsStore';
import {
  __resetSponsorsCache,
  readSnapshot,
  setSponsorsStore,
  writeSnapshot,
} from '../../../core/sponsors/sponsorsCache';
import { REVALIDATE_MIN_INTERVAL_MS } from '../../../core/sponsors/revalidation';
import type { Sponsor } from '../../../core/sponsors/sponsor';

const ORIGINAL_FETCH = globalThis.fetch;
const NOW = 1_800_000_000_000;

const FRAVEGA: Sponsor = {
  id: 'fravega',
  name: 'Frávega',
  logoUrl: 'https://cdn.lu32.com.ar/sponsors/fravega.png',
};
const VETERINARIA: Sponsor = {
  id: 'veterinaria',
  name: 'Veterinaria del Centro',
  logoUrl: 'https://cdn.lu32.com.ar/sponsors/vet.png',
};

/** A document body carrying these sponsors. */
function documentOf(sponsors: Sponsor[]): unknown {
  return { sponsors: sponsors.map((sponsor, index) => ({ ...sponsor, pos: (index + 1) * 10 })) };
}

function respond(init: { status: number; body?: unknown; etag?: string }): Response {
  return {
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    headers: { get: (name: string) => (name.toLowerCase() === 'etag' ? (init.etag ?? null) : null) },
    json: async () => init.body,
  } as unknown as Response;
}

/** Replaces fetch. `queue` is consumed one response per call. */
function mockFetch(...queue: (Response | Error | 'hang')[]): jest.Mock {
  const fn = jest.fn(async () => {
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next === 'hang') return new Promise<Response>(() => undefined);
    if (next instanceof Error) throw next;
    return next as Response;
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

/** The If-None-Match sent on the nth call, if any. */
function validatorOn(fn: jest.Mock, call: number): string | undefined {
  return (fn.mock.calls[call]?.[1] as { headers?: Record<string, string> })?.headers?.[
    'If-None-Match'
  ];
}

/** Captures the AppState handler so tests can drive foreground transitions. */
function captureAppState(): { send: (state: AppStateStatus) => Promise<void> } {
  let handler: ((state: AppStateStatus) => void) | undefined;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event: string, listener: (state: AppStateStatus) => void) => {
      handler = listener;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
  return {
    // ASYNC on purpose. The handler kicks off a fetch, so a synchronous act()
    // would return with React's act scope still open over work that had not
    // settled — which leaves the environment half-closed and makes the NEXT
    // test's render produce nothing at all.
    send: async (state) => {
      await act(async () => {
        handler?.(state);
      });
    },
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  setSponsorsStore(asyncStorageSponsorsStore);
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  __resetSponsorsCache();
  jest.restoreAllMocks();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('the first launch, with nothing cached', () => {
  it('fetches in full and shows what came back', async () => {
    mockFetch(respond({ status: 200, body: documentOf([FRAVEGA]), etag: '"abc"' }));

    const { result } = await renderHook(() => useSponsors());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.sponsors).toEqual([FRAVEGA]);
  });

  it('sends no validator, because there is no cache to validate against', async () => {
    const fn = mockFetch(respond({ status: 200, body: documentOf([FRAVEGA]), etag: '"abc"' }));

    const { result } = await renderHook(() => useSponsors());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(validatorOn(fn, 0)).toBeUndefined();
  });

  it('saves what it fetched so the next launch does not have to', async () => {
    mockFetch(respond({ status: 200, body: documentOf([FRAVEGA]), etag: '"abc"' }));

    const { result } = await renderHook(() => useSponsors());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await expect(readSnapshot()).resolves.toEqual({
      etag: '"abc"',
      sponsors: [FRAVEGA],
      fetchedAt: NOW,
    });
  });

  it('shows the error state when the very first fetch fails', async () => {
    mockFetch(new TypeError('Network request failed'));

    const { result } = await renderHook(() => useSponsors());

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('shows the empty state when the radio genuinely has no sponsors', async () => {
    mockFetch(respond({ status: 200, body: { sponsors: [] }, etag: '"vacio"' }));

    const { result } = await renderHook(() => useSponsors());

    await waitFor(() => expect(result.current.status).toBe('empty'));
  });
});

describe('every launch after the first', () => {
  beforeEach(async () => {
    await writeSnapshot({ etag: '"cacheado"', sponsors: [FRAVEGA], fetchedAt: NOW - 1 });
  });

  // THE POINT OF THE WHOLE CACHE. The network is never allowed to hold up the
  // grid: here it never answers at all, and the section is still on screen.
  it('draws the cached sponsors without waiting for the network', async () => {
    mockFetch('hang');

    const { result } = await renderHook(() => useSponsors());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.sponsors).toEqual([FRAVEGA]);
  });

  it('makes the request conditional with the stored etag', async () => {
    const fn = mockFetch(respond({ status: 304 }));

    const { result } = await renderHook(() => useSponsors());
    await waitFor(() => expect(fn).toHaveBeenCalled());

    expect(validatorOn(fn, 0)).toBe('"cacheado"');
    expect(result.current.sponsors).toEqual([FRAVEGA]);
  });

  it('applies a changed document over the cached one', async () => {
    mockFetch(respond({ status: 200, body: documentOf([VETERINARIA]), etag: '"nuevo"' }));

    const { result } = await renderHook(() => useSponsors());

    await waitFor(() => expect(result.current.sponsors).toEqual([VETERINARIA]));
    await expect(readSnapshot()).resolves.toMatchObject({ etag: '"nuevo"' });
  });

  // Airplane mode has to look exactly like a good connection here.
  it('keeps the cached sponsors when the network is gone', async () => {
    mockFetch(new TypeError('Network request failed'));

    const { result } = await renderHook(() => useSponsors());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.sponsors).toEqual([FRAVEGA]);
  });

  // A 304 changes nothing about WHAT is cached, but it does confirm the cache
  // is current. Without recording that, the interval would never advance and
  // the app would re-ask on every single return to the foreground.
  it('records that a 304 confirmed the cache is fresh', async () => {
    mockFetch(respond({ status: 304 }));

    const { result } = await renderHook(() => useSponsors());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await expect(readSnapshot()).resolves.toEqual({
      etag: '"cacheado"',
      sponsors: [FRAVEGA],
      fetchedAt: NOW,
    });
  });
});

describe('coming back from the background', () => {
  beforeEach(async () => {
    await writeSnapshot({ etag: '"cacheado"', sponsors: [FRAVEGA], fetchedAt: NOW });
  });

  it('checks again once the interval has passed', async () => {
    const appState = captureAppState();
    const fn = mockFetch(respond({ status: 304 }));

    const { result } = await renderHook(() => useSponsors());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const onLaunch = fn.mock.calls.length;

    jest.spyOn(Date, 'now').mockReturnValue(NOW + REVALIDATE_MIN_INTERVAL_MS + 1);
    await appState.send('active');

    await waitFor(() => expect(fn.mock.calls.length).toBe(onLaunch + 1));
  });

  // A radio app is opened and pocketed dozens of times an hour. Asking on every
  // one of those would be a request per glance for data that changes monthly.
  it('does not check again while the interval is still running', async () => {
    const appState = captureAppState();
    const fn = mockFetch(respond({ status: 304 }));

    const { result } = await renderHook(() => useSponsors());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const onLaunch = fn.mock.calls.length;

    jest.spyOn(Date, 'now').mockReturnValue(NOW + 60_000);
    await appState.send('active');

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(fn.mock.calls.length).toBe(onLaunch);
  });

  it.each<AppStateStatus>(['background', 'inactive'])(
    'ignores a transition to %s',
    async (state) => {
      const appState = captureAppState();
      const fn = mockFetch(respond({ status: 304 }));

      const { result } = await renderHook(() => useSponsors());
      await waitFor(() => expect(result.current.status).toBe('ready'));
      const onLaunch = fn.mock.calls.length;

      jest.spyOn(Date, 'now').mockReturnValue(NOW + REVALIDATE_MIN_INTERVAL_MS + 1);
      await appState.send(state);

      await waitFor(() => expect(result.current.status).toBe('ready'));
      expect(fn.mock.calls.length).toBe(onLaunch);
    },
  );
});

describe('retry', () => {
  it('fetches again after a failure and shows what it gets', async () => {
    mockFetch(
      new TypeError('Network request failed'),
      respond({ status: 200, body: documentOf([FRAVEGA]), etag: '"abc"' }),
    );

    const { result } = await renderHook(() => useSponsors());
    await waitFor(() => expect(result.current.status).toBe('error'));

    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.sponsors).toEqual([FRAVEGA]);
  });
});
