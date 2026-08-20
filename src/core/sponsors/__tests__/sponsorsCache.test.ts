import {
  __resetSponsorsCache,
  readSnapshot,
  setSponsorsStore,
  writeSnapshot,
  type SponsorsSnapshot,
  type SponsorsStore,
} from '../sponsorsCache';
import type { Sponsor } from '../sponsor';

const FRAVEGA: Sponsor = {
  id: 'fravega',
  name: 'Frávega',
  logoUrl: 'https://cdn.lu32.com.ar/sponsors/fravega.png',
};

function snapshot(overrides: Partial<SponsorsSnapshot> = {}): SponsorsSnapshot {
  return { etag: '"abc"', sponsors: [FRAVEGA], fetchedAt: 1_800_000_000_000, ...overrides };
}

/** A store that hands back whatever it was primed with and records writes. */
function fakeStore(stored: unknown): SponsorsStore & { written: SponsorsSnapshot[] } {
  const written: SponsorsSnapshot[] = [];
  return {
    written,
    read: async () => stored as SponsorsSnapshot | null,
    write: async (value) => {
      written.push(value);
    },
  };
}

afterEach(__resetSponsorsCache);

describe('with no store registered', () => {
  // Reading before boot has wired the adapter must answer "nothing cached"
  // rather than throw: the caller's next move is to fetch, which is exactly
  // right, and a throw here would take the section down before it drew once.
  it('reads as empty', async () => {
    await expect(readSnapshot()).resolves.toBeNull();
  });

  it('swallows a write instead of throwing', async () => {
    await expect(writeSnapshot(snapshot())).resolves.toBeUndefined();
  });
});

describe('readSnapshot', () => {
  it('returns what the store held', async () => {
    setSponsorsStore(fakeStore(snapshot()));

    await expect(readSnapshot()).resolves.toEqual(snapshot());
  });

  it('returns null when the store has nothing yet', async () => {
    setSponsorsStore(fakeStore(null));

    await expect(readSnapshot()).resolves.toBeNull();
  });

  // The cached bytes were written by a PREVIOUS build of the app, so they are
  // no more trustworthy than the network document — the shape may have moved
  // under them, or the write may have been cut off mid-way. They go through the
  // same sanitiser, so there is one rule about what a sponsor is, in one place.
  describe('re-validates what it read', () => {
    it('drops a cached sponsor that no longer passes the sanitiser', async () => {
      setSponsorsStore(
        fakeStore(snapshot({ sponsors: [FRAVEGA, { id: 'roto', name: 'Roto' } as Sponsor] })),
      );

      const result = await readSnapshot();

      expect(result?.sponsors).toEqual([FRAVEGA]);
    });

    it('keeps the stored order, which is the order it was shown in', async () => {
      const ids = ['tercero', 'primero', 'segundo'];
      setSponsorsStore(fakeStore(snapshot({ sponsors: ids.map((id) => ({ ...FRAVEGA, id })) })));

      const result = await readSnapshot();

      expect(result?.sponsors.map((s) => s.id)).toEqual(ids);
    });

    it.each([
      ['a truncated object', { etag: '"abc"' }],
      ['sponsors that are not an array', snapshot({ sponsors: 'nope' as unknown as Sponsor[] })],
      ['a string', 'nope'],
      ['a number', 7],
    ])('survives %s in the cache', async (_label, stored) => {
      setSponsorsStore(fakeStore(stored));

      const result = await readSnapshot();

      expect(result?.sponsors ?? []).toEqual([]);
    });
  });

  describe('etag', () => {
    it('keeps a stored etag so the next request can be conditional', async () => {
      setSponsorsStore(fakeStore(snapshot({ etag: '"abc"' })));

      await expect(readSnapshot()).resolves.toMatchObject({ etag: '"abc"' });
    });

    // Without an etag the next request simply cannot be conditional. That is a
    // full download, not an error, so it must not discard the cached sponsors.
    it.each([
      ['missing', undefined],
      ['not a string', 7],
    ])('reports a null etag when the stored one is %s', async (_label, etag) => {
      setSponsorsStore(fakeStore({ ...snapshot(), etag }));

      const result = await readSnapshot();

      expect(result?.etag).toBeNull();
      expect(result?.sponsors).toEqual([FRAVEGA]);
    });
  });

  describe('fetchedAt', () => {
    it('keeps a usable timestamp', async () => {
      setSponsorsStore(fakeStore(snapshot({ fetchedAt: 123 })));

      await expect(readSnapshot()).resolves.toMatchObject({ fetchedAt: 123 });
    });

    // A timestamp that cannot be reasoned about reads as "checked at the dawn
    // of time", which makes shouldRevalidate say yes — the safe answer.
    it.each([
      ['missing', undefined],
      ['NaN', Number.NaN],
      ['a string', 'ayer'],
    ])('reports 0 when the stored timestamp is %s', async (_label, fetchedAt) => {
      setSponsorsStore(fakeStore({ ...snapshot(), fetchedAt }));

      await expect(readSnapshot()).resolves.toMatchObject({ fetchedAt: 0 });
    });
  });

  // Storage fails for reasons the app cannot fix: a full disk, a corrupt
  // database, a platform that denied access. None of them is a reason to show
  // a listener an error, because the fetch that follows will fill the screen.
  it('returns null when the store throws', async () => {
    setSponsorsStore({
      read: async () => {
        throw new Error('disk is full');
      },
      write: async () => undefined,
    });

    await expect(readSnapshot()).resolves.toBeNull();
  });
});

describe('writeSnapshot', () => {
  it('hands the snapshot to the store', async () => {
    const store = fakeStore(null);
    setSponsorsStore(store);

    await writeSnapshot(snapshot());

    expect(store.written).toEqual([snapshot()]);
  });

  // The write is a cache fill, not the user's business: the sponsors are
  // already on screen, and a failed save only means the next launch fetches
  // again. Reporting it would be noise on top of a working app.
  it('swallows a store failure', async () => {
    setSponsorsStore({
      read: async () => null,
      write: async () => {
        throw new Error('disk is full');
      },
    });

    await expect(writeSnapshot(snapshot())).resolves.toBeUndefined();
  });
});

describe('__resetSponsorsCache', () => {
  it('drops the registered store', async () => {
    setSponsorsStore(fakeStore(snapshot()));
    __resetSponsorsCache();

    await expect(readSnapshot()).resolves.toBeNull();
  });
});
