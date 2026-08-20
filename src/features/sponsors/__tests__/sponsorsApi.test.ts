import { SPONSORS_URL, fetchSponsors } from '../api/sponsorsApi';

const ORIGINAL_FETCH = globalThis.fetch;

/** The document as the repo actually serves it. */
const DOCUMENT = {
  sponsors: [
    {
      id: 'fravega',
      pos: 10,
      name: 'Frávega',
      logoUrl: 'https://cdn.lu32.com.ar/sponsors/fravega.png',
      instagram: 'fravega',
    },
  ],
};

/** Stands in for one HTTP response; `etag` becomes the ETag header. */
function respond(init: { status: number; body?: unknown; etag?: string }): Response {
  return {
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    headers: { get: (name: string) => (name.toLowerCase() === 'etag' ? (init.etag ?? null) : null) },
    json: async () => {
      if (init.body === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return init.body;
    },
  } as unknown as Response;
}

function mockFetch(response: Response | Error): jest.Mock {
  const fn = jest.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

/** The headers the single fetch call was made with. */
function sentHeaders(fn: jest.Mock): Record<string, string> {
  return (fn.mock.calls[0]?.[1] as { headers?: Record<string, string> })?.headers ?? {};
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('fetchSponsors', () => {
  it('asks the document the app controls', async () => {
    const fn = mockFetch(respond({ status: 200, body: DOCUMENT, etag: '"abc"' }));

    await fetchSponsors(null);

    expect(fn.mock.calls[0]?.[0]).toBe(SPONSORS_URL);
    // Its own document, NOT app-config.json: that one is on the critical path
    // that keeps the radio on air, and sharing it would mean every sponsor
    // change invalidated the stream config's etag, and the other way round.
    expect(SPONSORS_URL).toMatch(/sponsors\.json$/);
  });

  describe('the conditional request', () => {
    it('sends the stored etag so an unchanged document costs no body', async () => {
      const fn = mockFetch(respond({ status: 304 }));

      await fetchSponsors('"c4c57aee"');

      expect(sentHeaders(fn)['If-None-Match']).toBe('"c4c57aee"');
    });

    // With nothing cached there is no etag to send, and sending an empty one
    // would make the server answer 304 against a cache that does not exist.
    it('sends no validator on the very first fetch', async () => {
      const fn = mockFetch(respond({ status: 200, body: DOCUMENT, etag: '"abc"' }));

      await fetchSponsors(null);

      expect(sentHeaders(fn)).not.toHaveProperty('If-None-Match');
    });

    it('reports 304 as unchanged, with nothing to apply', async () => {
      mockFetch(respond({ status: 304 }));

      await expect(fetchSponsors('"c4c57aee"')).resolves.toEqual({ status: 'unchanged' });
    });
  });

  describe('a changed document', () => {
    it('returns the parsed sponsors and the new etag', async () => {
      mockFetch(respond({ status: 200, body: DOCUMENT, etag: '"nuevo"' }));

      await expect(fetchSponsors('"viejo"')).resolves.toEqual({
        status: 'updated',
        etag: '"nuevo"',
        sponsors: [
          {
            id: 'fravega',
            name: 'Frávega',
            logoUrl: 'https://cdn.lu32.com.ar/sponsors/fravega.png',
            instagram: 'fravega',
          },
        ],
      });
    });

    // No validator means the next request simply cannot be conditional. That is
    // a full download of two kilobytes, not a failure.
    it('accepts a response with no ETag header', async () => {
      mockFetch(respond({ status: 200, body: DOCUMENT }));

      await expect(fetchSponsors(null)).resolves.toMatchObject({ status: 'updated', etag: null });
    });

    // A radio that ends every sponsorship must be able to say so. An empty
    // list is a legitimate document, not an error.
    it('accepts an empty sponsors array', async () => {
      mockFetch(respond({ status: 200, body: { sponsors: [] }, etag: '"vacio"' }));

      await expect(fetchSponsors(null)).resolves.toMatchObject({
        status: 'updated',
        sponsors: [],
      });
    });
  });

  // Everything below leaves the cached grid on screen untouched, which is why
  // these throw rather than returning an empty list: an empty list would be
  // written to the cache and would empty the section on every later launch.
  describe('refuses to turn a failure into an empty section', () => {
    it.each([404, 500, 403])('throws on HTTP %s', async (status) => {
      mockFetch(respond({ status }));

      await expect(fetchSponsors(null)).rejects.toThrow(String(status));
    });

    it('propagates a network failure', async () => {
      mockFetch(new TypeError('Network request failed'));

      await expect(fetchSponsors(null)).rejects.toThrow('Network request failed');
    });

    it('throws on a truncated body rather than reading it as no sponsors', async () => {
      mockFetch(respond({ status: 200, etag: '"abc"' }));

      await expect(fetchSponsors(null)).rejects.toThrow();
    });

    // A botched deploy — a stray string, an array at the root, a renamed key —
    // must not be mistaken for "the radio has no sponsors any more".
    it.each([
      ['a string', 'nope'],
      ['a number', 7],
      ['null', null],
      ['an array at the root', [{ id: 'x' }]],
      ['an object with no sponsors key', { auspiciantes: [] }],
      ['a sponsors key that is not an array', { sponsors: 'nope' }],
    ])('throws when the document is %s', async (_label, body) => {
      mockFetch(respond({ status: 200, body, etag: '"abc"' }));

      await expect(fetchSponsors(null)).rejects.toThrow();
    });
  });
});
