import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SPONSORS_CACHE_KEY,
  asyncStorageSponsorsStore,
} from '../asyncStorageSponsorsStore';
import {
  __resetSponsorsCache,
  readSnapshot,
  setSponsorsStore,
  writeSnapshot,
  type SponsorsSnapshot,
} from '../sponsorsCache';
import type { Sponsor } from '../sponsor';

const FRAVEGA: Sponsor = {
  id: 'fravega',
  name: 'Frávega',
  logoUrl: 'https://cdn.lu32.com.ar/sponsors/fravega.png',
  instagram: 'fravega',
};

const SNAPSHOT: SponsorsSnapshot = {
  etag: '"c4c57aee"',
  sponsors: [FRAVEGA],
  fetchedAt: 1_800_000_000_000,
};

beforeEach(async () => {
  await AsyncStorage.clear();
  setSponsorsStore(asyncStorageSponsorsStore);
});

afterEach(__resetSponsorsCache);

// The adapter is exercised THROUGH the port, because the seam that matters is
// the one the app actually uses: a launch writes a snapshot and the next launch
// has to get it back, with the etag intact so the request can be conditional.
describe('asyncStorageSponsorsStore, through the port', () => {
  it('gives back on the next launch exactly what the last one saved', async () => {
    await writeSnapshot(SNAPSHOT);

    await expect(readSnapshot()).resolves.toEqual(SNAPSHOT);
  });

  it('reads as empty before anything has ever been saved', async () => {
    await expect(readSnapshot()).resolves.toBeNull();
  });

  it('overwrites rather than accumulating snapshots', async () => {
    await writeSnapshot(SNAPSHOT);
    await writeSnapshot({ ...SNAPSHOT, etag: '"nuevo"', sponsors: [] });

    await expect(readSnapshot()).resolves.toMatchObject({ etag: '"nuevo"', sponsors: [] });
  });

  // A write cut off by the OS killing the app leaves half a document behind.
  // JSON.parse throws on it, and the port turns that into "nothing cached" —
  // the section fetches and refills instead of failing to draw.
  it('reads as empty when the stored bytes are not valid JSON', async () => {
    await AsyncStorage.setItem(SPONSORS_CACHE_KEY, '{"etag":"abc","sponsors":[');

    await expect(readSnapshot()).resolves.toBeNull();
  });

  it('survives stored JSON of an entirely unexpected shape', async () => {
    await AsyncStorage.setItem(SPONSORS_CACHE_KEY, '"just a string"');

    await expect(readSnapshot()).resolves.toBeNull();
  });

  // The key carries a version so a future change of shape can abandon the old
  // cache by bumping it, instead of shipping a migration for two kilobytes.
  it('stores everything under one versioned key', async () => {
    await writeSnapshot(SNAPSHOT);

    await expect(AsyncStorage.getAllKeys()).resolves.toEqual([SPONSORS_CACHE_KEY]);
    expect(SPONSORS_CACHE_KEY).toMatch(/\.v\d+$/);
  });
});
