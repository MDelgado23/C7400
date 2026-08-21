/**
 * What a theme preference IS — PURE, no storage, no React, no vendor.
 *
 * Three modules depend on getting this exactly right and none of them should be
 * deciding it themselves: the device cache, the account document and the React
 * provider. Keeping the vocabulary here means a stored value, a synced value and
 * a rendered value are all validated by the same function, so they cannot drift.
 */

/** What the user CHOSE. Not what is on screen — see `resolveColorScheme`. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** What is actually PAINTED. Only ever one of two palettes. */
export type ColorScheme = 'light' | 'dark';

/**
 * What the app is before anybody chooses.
 *
 * DELIBERATELY 'dark' AND NOT 'system'. The app has only ever been dark, so
 * every existing listener is on dark without having picked it. Defaulting to
 * 'system' would repaint the app for everyone whose phone is set to light — a
 * change they did not ask for, from an update they only installed for the news.
 * Automatic is offered, prominently, and it is one tap away. It is just not
 * imposed.
 */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark';

/**
 * The choices, in the order the picker shows them.
 *
 * Automatic leads because it is the one most people want once they know it is
 * there; dark is last because it is where they already are.
 */
export const THEME_PREFERENCE_OPTIONS: readonly ThemePreference[] = [
  'system',
  'light',
  'dark',
] as const;

const LABELS: Record<ThemePreference, string> = {
  system: 'Automático',
  light: 'Claro',
  dark: 'Oscuro',
};

/**
 * A preference from untrusted bytes, or `null`.
 *
 * `null` rather than the default ON PURPOSE, and the distinction is load-bearing
 * upstream: "this device has nothing stored" lets the account's value take over,
 * while "this device says dark" is a choice that has to be honoured. Collapsing
 * both into 'dark' here would silently overwrite one with the other.
 */
export function parseThemePreference(raw: unknown): ThemePreference | null {
  return raw === 'system' || raw === 'light' || raw === 'dark' ? raw : null;
}

/**
 * The palette to paint, given the choice and what the phone reports.
 *
 * `systemScheme` is `null` more often than you would think: React Native's
 * `useColorScheme` answers null where the platform has no notion of one, and for
 * a frame after Android returns the app to the foreground. Reading that as
 * 'light' would flash a white app at someone who asked to follow their system,
 * so an unknown system falls back to the app's default rather than guessing.
 */
export function resolveColorScheme(
  preference: ThemePreference,
  systemScheme: ColorScheme | null,
): ColorScheme {
  if (preference !== 'system') return preference;
  // The default is itself a scheme today; the cast documents the dependency so
  // that changing DEFAULT_THEME_PREFERENCE to 'system' fails loudly here rather
  // than recursing.
  return systemScheme ?? (DEFAULT_THEME_PREFERENCE as ColorScheme);
}

/** How a preference is named to the user. */
export function themePreferenceLabel(preference: ThemePreference): string {
  return LABELS[preference];
}
