import { fetchCategories, fetchNews } from '../api/newsApi';
import { NEWS_PAGE_SIZE } from '../newsWindow';
import { __resetRemoteConfigCache } from '../../../core/config/remoteConfig';

const ORIGINAL_FETCH = globalThis.fetch;

const ARTICLE = {
  id: '6a87',
  title: 'AOMA inicia medidas gremiales',
  deck: 'La organización declaró el estado de alerta',
  kicker: 'CONFLICTO SALARIAL',
  date: '2026-08-20T21:30:29.827Z',
  url: '/locales/aoma-inicia-medidas-gremiales',
};

/** Replaces fetch; records every URL asked for. */
function mockFetch(body: unknown = { data: [ARTICLE] }): jest.Mock {
  const fn = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
  }));
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

/** The URL of the nth call. */
function urlOf(fn: jest.Mock, call = 0): string {
  return String(fn.mock.calls[call]?.[0] ?? '');
}

beforeEach(() => {
  __resetRemoteConfigCache();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  __resetRemoteConfigCache();
});

describe('fetchNews', () => {
  it('asks for the newest notes when no page is given', async () => {
    const fn = mockFetch();

    await fetchNews();

    // The article endpoint is the second call; the first is the remote config.
    const url = urlOf(fn, fn.mock.calls.length - 1);
    expect(url).toContain('/article');
    expect(url).not.toContain('skip');
  });

  // `?skip=N` is how this API pages — verified against the live host. The
  // `nextCursor` it returns in the body is a red herring: no parameter accepts
  // it, and the page size cannot be changed either.
  it.each([NEWS_PAGE_SIZE, 40, 200])('asks for the page starting at %i', async (skip) => {
    const fn = mockFetch();

    await fetchNews(skip);

    expect(urlOf(fn, fn.mock.calls.length - 1)).toContain(`skip=${skip}`);
  });

  it('omits the parameter for the first page rather than sending zero', async () => {
    const fn = mockFetch();

    await fetchNews(0);

    expect(urlOf(fn, fn.mock.calls.length - 1)).not.toContain('skip');
  });

  it('maps what came back through the usual parser', async () => {
    mockFetch();

    const items = await fetchNews();

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: '6a87',
      title: 'AOMA inicia medidas gremiales',
      kicker: 'CONFLICTO SALARIAL',
      publishedAt: '2026-08-20T21:30:29.827Z',
    });
  });

  it('reads a page with no articles as an empty one', async () => {
    mockFetch({ data: [] });

    await expect(fetchNews(120)).resolves.toEqual([]);
  });

  it('throws on a bad status so the query can show its error state', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(fetchNews()).rejects.toThrow('503');
  });
});

describe('fetchNews, filtered by section', () => {
  const LOCALES = '6837ac247af5dba70a5382e6';

  // Verified against the live host: `?category=<id>` returns only that section.
  // Filtering by NAME answers HTTP 500, so the id is what gets sent.
  it('asks for one section when given its id', async () => {
    const fn = mockFetch();

    await fetchNews(0, LOCALES);

    expect(urlOf(fn, fn.mock.calls.length - 1)).toContain(`category=${LOCALES}`);
  });

  it('pages inside the section', async () => {
    const fn = mockFetch();

    await fetchNews(40, LOCALES);

    const url = urlOf(fn, fn.mock.calls.length - 1);
    expect(url).toContain('skip=40');
    expect(url).toContain(`category=${LOCALES}`);
  });

  it.each([
    ['no section is given', undefined],
    ['the section is blank', '   '],
  ])('asks for everything when %s', async (_label, category) => {
    const fn = mockFetch();

    await fetchNews(0, category);

    expect(urlOf(fn, fn.mock.calls.length - 1)).not.toContain('category');
  });
});

describe('fetchCategories', () => {
  it('returns the sections, written for a chip', async () => {
    mockFetch({ data: [{ id: 'a', name: 'LOCALES' }, { id: 'b', name: 'LA REGIÓN' }] });

    await expect(fetchCategories()).resolves.toEqual([
      { id: 'a', name: 'Locales' },
      { id: 'b', name: 'La Región' },
    ]);
  });

  it('asks the category endpoint', async () => {
    const fn = mockFetch({ data: [] });

    await fetchCategories();

    expect(urlOf(fn, fn.mock.calls.length - 1)).toMatch(/\/category$/);
  });

  // The chips are decoration around the feed: if the list cannot be read they
  // simply do not appear, and the news is unaffected.
  it('comes back empty rather than throwing on a bad status', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(fetchCategories()).resolves.toEqual([]);
  });

  it('comes back empty when the network is gone', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    await expect(fetchCategories()).resolves.toEqual([]);
  });
});
