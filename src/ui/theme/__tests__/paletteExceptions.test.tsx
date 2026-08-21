import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, fireEvent, render } from '@testing-library/react-native';
import { palettes } from '../tokens';
import {
  __resetTheme,
  setThemeStore,
  type ThemeStore,
} from '../../../core/theme/themeService';
import { PlayerScreenView } from '../../../features/radio/PlayerScreenView';
import { AccountView } from '../../../features/account/AccountView';
import { CategoryBar } from '../../../features/news/CategoryBar';
import { PhotoViewer } from '../../../features/news/PhotoViewer';
import { SponsorsView } from '../../../features/sponsors/SponsorsView';
import { LOGO_ASPECT } from '../../../features/sponsors/grid';
import { accountSections } from '../../../features/account/accountMenu';

/**
 * The places where the ACTIVE PALETTE IS NOT THE ANSWER, and the bugs that
 * follow from reaching for it anyway.
 *
 * Two families live here, and they fail the same way. In the DARK palette
 * `text` is the same white as `onPrimary` and the same white the overlays want,
 * so a component that wrongly reads `colors.text` looks perfect — and keeps
 * looking perfect through every other test in this repo, because every other
 * test runs dark. The mistake only surfaces in the light palette.
 *
 *   1. CONTENT ON A BRAND FILL. The button is `primary` in both themes, so its
 *      label follows `onPrimary`, never the page text. Read `text` instead and
 *      the light theme paints near-black on blue.
 *
 *   2. CONTENT ON A FIXED-DARK OVERLAY. The lightbox is black by design in both
 *      themes — nothing may compete with the photo. So its controls are pinned
 *      to the DARK palette outright. Read the active one instead and the light
 *      theme paints near-black on black: a close button that is simply gone.
 *
 * Everything below renders in LIGHT on purpose. That is the only condition
 * under which either mistake is visible at all.
 */

const settle = () => new Promise<void>((resolve) => { setImmediate(() => resolve()); });

const storeFor = (preference: string): ThemeStore => ({
  read: () => Promise.resolve(preference),
  write: () => Promise.resolve(),
});

interface Painted {
  props?: { style?: unknown; color?: unknown };
  children?: unknown[];
}

/** The colour one element resolves to, whether it arrived as a prop or a style. */
function colorOf(element: Painted): string | undefined {
  const fromProp = element.props?.color;
  if (typeof fromProp === 'string') return fromProp;
  const flat = StyleSheet.flatten(element.props?.style as never) as { color?: string } | undefined;
  return flat?.color;
}

/**
 * Every colour painted anywhere inside an element, itself included.
 *
 * Hand-rolled rather than reached for through a query, because an icon glyph is
 * not addressable: it has no text, no label and no testID. Walking the subtree
 * of a button we DO have a handle on is what keeps the assertion scoped to that
 * button instead of to whatever else is on the screen.
 */
function colorsUnder(element: Painted): (string | undefined)[] {
  const found: (string | undefined)[] = [colorOf(element)];
  for (const child of element.children ?? []) {
    if (child !== null && typeof child === 'object') found.push(...colorsUnder(child as Painted));
  }
  return found;
}

beforeEach(async () => {
  __resetTheme();
  setThemeStore(storeFor('light'));
  await act(async () => {
    await settle();
  });
});

afterEach(__resetTheme);

describe('in the light palette, content on a brand fill', () => {
  it('is not painted with the page text colour', async () => {
    // The premise of the whole file, asserted once. If these two ever converge,
    // every test below stops proving anything.
    expect(palettes.light.onPrimary).not.toBe(palettes.light.text);
  });

  it('keeps the primary button label readable', async () => {
    const view = await render(
      <AccountView
        session={{ isAnonymous: true, email: null }}
        sections={accountSections('light')}
        onSelectItem={jest.fn()}
        onSignIn={jest.fn()}
        onSignUp={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    expect(colorOf(view.getByText('Crear cuenta'))).toBe(palettes.light.onPrimary);
  });

  it('keeps the active category chip readable', async () => {
    const view = await render(
      <CategoryBar
        categories={[{ id: 'loc', name: 'Locales' }]}
        selectedId="loc"
        onSelect={jest.fn()}
      />,
    );

    expect(colorOf(view.getByText('Locales'))).toBe(palettes.light.onPrimary);
  });

  it('keeps the play button icon visible', async () => {
    // The single most important control in a radio app, and a DIFFERENT pattern
    // from the labels above: the icon takes a `color` prop rather than a style,
    // so it is a separate place to get this wrong.
    const view = await render(
      <PlayerScreenView
        state="paused"
        title="La Mañana de LU32"
        onToggle={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    const painted = colorsUnder(view.getByLabelText('Reproducir'));

    expect(painted).toContain(palettes.light.onPrimary);
    expect(painted).not.toContain(palettes.light.text);
  });

  it('keeps the retry button label readable', async () => {
    const view = await render(
      <PlayerScreenView
        state="error"
        title="La Mañana de LU32"
        onToggle={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(colorOf(view.getByText('Reintentar'))).toBe(palettes.light.onPrimary);
  });
});

describe('in the light palette, content on the fixed-dark lightbox', () => {
  /**
   * An Android phone with the three-button navigation bar. The viewer draws
   * edge to edge and reads these to keep its controls clear of the system bars,
   * and `useSafeAreaInsets` throws outright without a provider above it.
   */
  const METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 24, left: 0, right: 0, bottom: 48 },
  };

  const renderViewer = () =>
    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <PhotoViewer uri="https://cdn/720.webp" onClose={jest.fn()} />
      </SafeAreaProvider>,
    );

  it('keeps the close button visible against the black backdrop', async () => {
    // The backdrop is `#000` in BOTH themes, deliberately. Follow the light
    // palette here and the icon is near-black on black — around 1.1:1, which is
    // not a contrast problem, it is a missing button. The only way out of the
    // viewer, gone.
    const view = await renderViewer();

    const painted = colorsUnder(view.getByLabelText('Cerrar'));

    expect(painted).toContain(palettes.dark.text);
    expect(painted).not.toContain(palettes.light.text);
  });

  it('keeps the gesture hint legible against the black backdrop', async () => {
    // `muted` on the light palette is #55658A, which lands at 3.62:1 on black —
    // under AA for prose, where the same token on the dark palette gives 8.57:1.
    const view = await renderViewer();

    const hint = colorOf(view.getByText(/tocá dos veces para acercar/));

    expect(hint).toBe(palettes.dark.textMuted);
    expect(hint).not.toBe(palettes.light.textMuted);
  });
});

describe('the sponsor plate, in either palette', () => {
  /**
   * The backing a sponsor's logo is drawn on. Businesses hand over artwork with
   * a transparent background, so whatever is behind it IS the logo's background
   * — and it has to be white in both themes, because a dark logo on
   * transparency over a dark plate disappears entirely. That is the one thing
   * this section may never do to the people paying to be in it.
   *
   * It was written as `colors.text`, which is white in the dark palette and
   * near-black in the light one. Same failure mode as everything else in this
   * file: correct-looking for as long as only one theme existed.
   */
  const MOTO = { width: 432, height: 693 };

  const renderSponsors = async () => {
    const view = await render(
      <SponsorsView
        status="ready"
        sponsors={[{ id: 'lu32', name: 'LU32 Radio', logoUrl: 'https://cdn/lu32.png' }]}
        onRetry={jest.fn()}
        onSelectSponsor={jest.fn()}
      />,
    );
    await fireEvent(view.getByTestId('sponsors-grid'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, ...MOTO } },
    });
    return view;
  };

  const plateOf = (view: Awaited<ReturnType<typeof renderSponsors>>) =>
    StyleSheet.flatten(view.getByTestId('logo-lu32').props.style as never) as {
      backgroundColor?: string;
      width?: number;
      height?: number;
    };

  it.each(['light', 'dark'])('is white under the %s theme', async (preference) => {
    __resetTheme();
    setThemeStore(storeFor(preference));
    await act(async () => {
      await settle();
    });

    expect(plateOf(await renderSponsors()).backgroundColor).toBe('#FFFFFF');
  });

  // Padding and the plate colour are one bug, not two: the bars a mismatched
  // shape creates are PLATE, so they are only invisible while the plate matches
  // the artwork. Both halves have to hold.
  it('is exactly the shape of the artwork, so contain has nothing to pad', async () => {
    const plate = plateOf(await renderSponsors());

    expect(plate.width).toBeDefined();
    expect(plate.height).toBeDefined();
    expect((plate.width as number) / (plate.height as number)).toBeCloseTo(LOGO_ASPECT, 5);
  });
});

describe('in the dark palette', () => {
  beforeEach(async () => {
    __resetTheme();
    setThemeStore(storeFor('dark'));
    await act(async () => {
      await settle();
    });
  });

  it('leaves the button label exactly where it always was', async () => {
    // The dark theme must not have moved. `onPrimary` and `text` are the same
    // white here, so this is the check that the refactor was a no-op for every
    // listener who never touches the setting.
    const view = await render(
      <AccountView
        session={{ isAnonymous: true, email: null }}
        sections={accountSections('dark')}
        onSelectItem={jest.fn()}
        onSignIn={jest.fn()}
        onSignUp={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    expect(colorOf(view.getByText('Crear cuenta'))).toBe(palettes.dark.text);
  });
});
