import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

let mockSystemScheme: 'light' | 'dark' | null = 'dark';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockSystemScheme,
}));

import { useColors, useThemeScheme, useThemedStyles } from '../useTheme';
import { palettes } from '../tokens';
import {
  __resetTheme,
  setThemePreference,
  setThemeStore,
  type ThemeStore,
} from '../../../core/theme/themeService';

const settle = () => new Promise<void>((resolve) => { setImmediate(() => resolve()); });

function memoryStore(stored: unknown = null): ThemeStore {
  return {
    read: () => Promise.resolve(stored),
    write: () => Promise.resolve(),
  };
}

/** Renders the active background colour, so a test can read it off the tree. */
function Probe() {
  const colors = useColors();
  return <Text testID="probe">{colors.background}</Text>;
}

/** Renders the active scheme name. */
function SchemeProbe() {
  return <Text testID="probe">{useThemeScheme()}</Text>;
}

beforeEach(() => {
  mockSystemScheme = 'dark';
  __resetTheme();
});

afterEach(__resetTheme);

async function boot(stored: unknown = null) {
  setThemeStore(memoryStore(stored));
  await act(async () => {
    await settle();
  });
}

describe('the palette a component is handed', () => {
  it('is the dark one before anybody has chosen', async () => {
    await boot();

    const view = await render(<Probe />);

    expect(view.getByTestId('probe')).toHaveTextContent(palettes.dark.background);
  });

  it('is the light one when the user chose light', async () => {
    await boot('light');

    const view = await render(<Probe />);

    expect(view.getByTestId('probe')).toHaveTextContent(palettes.light.background);
  });

  it('changes under a component that is already on screen', async () => {
    // The entire feature in one assertion: no remount, no navigation, no
    // reload. The user taps and the app is a different colour.
    await boot();
    const view = await render(<Probe />);

    await act(async () => {
      setThemePreference('light');
    });

    expect(view.getByTestId('probe')).toHaveTextContent(palettes.light.background);
  });

  it('needs no provider above it', async () => {
    // Deliberate: a provider has a failure mode where forgetting to mount it
    // paints everything dark in silence, and it would have meant wrapping every
    // existing view test to keep them passing.
    await boot('light');

    const view = await render(<Probe />);

    expect(view.getByTestId('probe')).toHaveTextContent(palettes.light.background);
  });
});

describe('following the phone', () => {
  it('paints light when the system is light', async () => {
    mockSystemScheme = 'light';
    await boot('system');

    const view = await render(<SchemeProbe />);

    expect(view.getByTestId('probe')).toHaveTextContent('light');
  });

  it('paints dark when the system is dark', async () => {
    mockSystemScheme = 'dark';
    await boot('system');

    const view = await render(<SchemeProbe />);

    expect(view.getByTestId('probe')).toHaveTextContent('dark');
  });

  it('falls back to the default when the phone will not say', async () => {
    // Android reports null for a frame when it returns the app to the
    // foreground. Reading that as light flashes a white app at somebody who
    // asked to follow their system.
    mockSystemScheme = null;
    await boot('system');

    const view = await render(<SchemeProbe />);

    expect(view.getByTestId('probe')).toHaveTextContent('dark');
  });

  it('ignores the phone entirely once the choice is explicit', async () => {
    mockSystemScheme = 'light';
    await boot('dark');

    const view = await render(<SchemeProbe />);

    expect(view.getByTestId('probe')).toHaveTextContent('dark');
  });
});

describe('themed styles', () => {
  const makeStyles = jest.fn((colors: { background: string }) => ({
    page: { backgroundColor: colors.background },
  }));

  function StyledProbe() {
    const styles = useThemedStyles(makeStyles);
    return <Text testID="probe">{String(styles.page.backgroundColor)}</Text>;
  }

  beforeEach(() => makeStyles.mockClear());

  it('builds the sheet from the active palette', async () => {
    await boot('light');

    const view = await render(<StyledProbe />);

    expect(view.getByTestId('probe')).toHaveTextContent(palettes.light.background);
  });

  it('rebuilds it when the theme changes', async () => {
    await boot();
    const view = await render(<StyledProbe />);

    await act(async () => {
      setThemePreference('light');
    });

    expect(view.getByTestId('probe')).toHaveTextContent(palettes.light.background);
  });

  /**
   * A factory nothing has built yet, plus the component that uses it.
   *
   * Each counting test needs its OWN, because the cache is module-level and
   * outlives a test — which is the whole point of it, and also the reason a
   * shared factory would report zero calls in the second test to ask.
   */
  function countingProbe() {
    const factory = jest.fn((colors: { background: string }) => ({
      page: { backgroundColor: colors.background },
    }));
    function Counted() {
      const styles = useThemedStyles(factory);
      return <Text testID="probe">{String(styles.page.backgroundColor)}</Text>;
    }
    return { factory, Counted };
  }

  it('builds each sheet once per palette, however many components use it', async () => {
    // The whole reason this helper exists rather than a bare useMemo. Every row
    // of a long list calls the same factory, and a list that rebuilds its
    // StyleSheet per row while scrolling is how a theme refactor becomes a
    // performance regression.
    await boot();
    const { factory, Counted } = countingProbe();

    await render(<Counted />);
    await render(<Counted />);
    await render(<Counted />);

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('builds it a second time only for the second palette', async () => {
    await boot();
    const { factory, Counted } = countingProbe();
    await render(<Counted />);

    await act(async () => {
      setThemePreference('light');
    });
    await render(<Counted />);

    expect(factory).toHaveBeenCalledTimes(2);
  });
});
