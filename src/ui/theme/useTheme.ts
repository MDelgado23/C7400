import { useMemo, useSyncExternalStore } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import {
  getThemePreference,
  hasHydratedTheme,
  subscribeToTheme,
} from '../../core/theme/themeService';
import {
  resolveColorScheme,
  type ColorScheme,
  type ThemePreference,
} from '../../core/theme/themePreference';
import { palettes, type Palette } from './tokens';

/**
 * How a component gets the colours it is supposed to paint with.
 *
 * DELIBERATELY NOT A REACT CONTEXT, and that is the one design decision in this
 * file worth arguing about. A provider has a failure mode this does not: forget
 * to mount it — in the app, in a test, in a screen rendered outside the
 * navigator — and every consumer silently falls back to one palette. Nothing
 * throws, nothing looks broken, the toggle just does not work. Reading straight
 * from the port removes the question: there is no "above" to be missing.
 *
 * It also meant the fifteen existing view tests did not have to be wrapped in a
 * provider to keep passing, which is fifteen files of churn buying nothing.
 *
 * The cost is one subscription per component instead of one for the whole tree.
 * That cost is a `Set.add` and a callback, and React batches the resulting
 * renders — while the thing it buys, styles that cannot be stale, is the entire
 * point of the refactor.
 *
 * `useSyncExternalStore` is the right primitive here rather than
 * useState + useEffect: the port is an external store with exactly the
 * subscribe/getSnapshot pair it wants, and it closes the window where a
 * component mounted mid-change renders the previous value for a frame.
 */

/** The user's CHOICE — 'system', 'light' or 'dark'. Not what is painted. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribeToTheme, getThemePreference);
}

/**
 * Whether the device has been consulted yet.
 *
 * Only the splash should care. Everything else renders the default happily and
 * is repainted if the stored choice turns out to differ — under the splash,
 * where nobody sees it happen.
 */
export function useThemeHydrated(): boolean {
  return useSyncExternalStore(subscribeToTheme, hasHydratedTheme);
}

/**
 * The scheme actually being PAINTED: the choice, resolved against the phone.
 *
 * React Native answers `null` for the system scheme where the platform has no
 * notion of one, and for a frame after Android brings the app back to the
 * foreground; `resolveColorScheme` is where that is turned into something safe,
 * so the decision lives in a pure function with tests rather than in a hook.
 */
export function useThemeScheme(): ColorScheme {
  const preference = useThemePreference();
  const system = useSystemColorScheme();
  return resolveColorScheme(preference, system === 'light' || system === 'dark' ? system : null);
}

/** The active palette. What every component styles itself from. */
export function useColors(): Palette {
  return palettes[useThemeScheme()];
}

/**
 * Per-palette cache of built stylesheets.
 *
 * A `WeakMap` keyed by the factory, holding one sheet per scheme. Factories are
 * module-level constants, so in practice each one is built at most twice for the
 * lifetime of the app — no matter how many components use it or how often they
 * mount.
 *
 * That is what this helper is FOR. Every row of a long list calls the same
 * factory, and a `useMemo` alone would rebuild the sheet on every remount while
 * the user scrolls. Weak keys mean a factory that goes away takes its sheets
 * with it, so nothing leaks.
 */
const sheets = new WeakMap<object, Partial<Record<ColorScheme, unknown>>>();

/**
 * The component's stylesheet, built from the active palette.
 *
 * The factory MUST be a module-level constant, not an inline arrow. An inline
 * one is a new key on every render, which turns the cache into a leak and
 * rebuilds the sheet every frame — the exact problem this exists to solve.
 *
 *     const makeStyles = (c: Palette) => StyleSheet.create({ ... });
 *     const styles = useThemedStyles(makeStyles);
 */
export function useThemedStyles<T>(factory: (colors: Palette) => T): T {
  const scheme = useThemeScheme();

  return useMemo(() => {
    const cached = sheets.get(factory) ?? {};
    if (cached[scheme] === undefined) {
      cached[scheme] = factory(palettes[scheme]);
      sheets.set(factory, cached);
    }
    return cached[scheme] as T;
  }, [factory, scheme]);
}
