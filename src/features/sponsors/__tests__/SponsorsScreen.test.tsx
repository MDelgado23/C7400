import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SponsorsScreen } from '../SponsorsScreen';
import { asyncStorageSponsorsStore } from '../../../core/sponsors/asyncStorageSponsorsStore';
import {
  __resetSponsorsCache,
  setSponsorsStore,
  writeSnapshot,
} from '../../../core/sponsors/sponsorsCache';
import type { Sponsor } from '../../../core/sponsors/sponsor';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

const FRAVEGA: Sponsor = {
  id: 'fravega',
  name: 'Frávega',
  logoUrl: 'https://cdn.lu32.com.ar/sponsors/fravega.png',
  instagram: 'fravega',
};

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(async () => {
  await AsyncStorage.clear();
  setSponsorsStore(asyncStorageSponsorsStore);
  await writeSnapshot({ etag: '"abc"', sponsors: [FRAVEGA], fetchedAt: Date.now() });
  // Never answers: the grid comes from the cache, so nothing here waits on it.
  globalThis.fetch = jest.fn(
    () => new Promise<Response>(() => undefined),
  ) as unknown as typeof fetch;
});

afterEach(() => {
  __resetSponsorsCache();
  globalThis.fetch = ORIGINAL_FETCH;
});

async function renderScreen() {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <SponsorsScreen />
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('sponsor-fravega')).toBeTruthy());
}

describe('SponsorsScreen', () => {
  it('shows the cached grid', async () => {
    await renderScreen();

    expect(screen.getByLabelText('Frávega')).toBeTruthy();
  });

  // The sheet is a modal, not a route: it must not be mounted until a tile is
  // actually tapped, or a screen reader would find its buttons behind the grid.
  it('keeps the sheet shut until a sponsor is tapped', async () => {
    await renderScreen();

    expect(screen.queryByLabelText('Instagram')).toBeNull();
  });

  it('opens the sheet for the sponsor that was tapped', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('sponsor-fravega'));

    expect(screen.getByLabelText('Instagram')).toBeTruthy();
  });

  it('shuts the sheet again on dismiss', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId('sponsor-fravega'));

    await fireEvent.press(screen.getByLabelText('Cerrar'));

    await waitFor(() => expect(screen.queryByLabelText('Instagram')).toBeNull());
  });
});
