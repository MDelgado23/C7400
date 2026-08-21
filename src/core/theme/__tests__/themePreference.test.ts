import {
  DEFAULT_THEME_PREFERENCE,
  THEME_PREFERENCE_OPTIONS,
  parseThemePreference,
  resolveColorScheme,
  themePreferenceLabel,
  type ThemePreference,
} from '../themePreference';

describe('reading a stored preference', () => {
  it('accepts each of the three the app offers', () => {
    expect(parseThemePreference('system')).toBe('system');
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
  });

  it('rejects anything else', () => {
    // The bytes come off a disk or out of a document written by ANOTHER build.
    // Trusting them would put an unknown string where a palette key is expected
    // and paint the app with `undefined`.
    expect(parseThemePreference('Oscuro')).toBeNull();
    expect(parseThemePreference('')).toBeNull();
    expect(parseThemePreference(0)).toBeNull();
    expect(parseThemePreference(null)).toBeNull();
    expect(parseThemePreference(undefined)).toBeNull();
    expect(parseThemePreference({ theme: 'dark' })).toBeNull();
  });

  it('does not answer with the default for junk', () => {
    // `null` and 'dark' mean different things upstream: "nothing chosen here",
    // which lets the account speak, versus "this device says dark", which wins.
    expect(parseThemePreference('nope')).not.toBe(DEFAULT_THEME_PREFERENCE);
  });
});

describe('resolving a preference into a palette', () => {
  it('takes an explicit choice literally, whatever the phone says', () => {
    expect(resolveColorScheme('light', 'dark')).toBe('light');
    expect(resolveColorScheme('dark', 'light')).toBe('dark');
  });

  it('follows the phone when the choice is automatic', () => {
    expect(resolveColorScheme('system', 'light')).toBe('light');
    expect(resolveColorScheme('system', 'dark')).toBe('dark');
  });

  it('falls back to the default when the phone will not say', () => {
    // useColorScheme answers null on a platform with no notion of one, and for
    // a frame after a background/foreground on Android. Reading that as 'light'
    // would flash a white app at somebody who asked to follow their system.
    expect(resolveColorScheme('system', null)).toBe(DEFAULT_THEME_PREFERENCE);
  });
});

describe('the choices offered', () => {
  it('leads with automatic, then light, then dark', () => {
    // Order is part of the design: the recommendation goes first.
    expect(THEME_PREFERENCE_OPTIONS).toEqual(['system', 'light', 'dark']);
  });

  it('names every one of them in Spanish', () => {
    expect(themePreferenceLabel('system')).toBe('Automático');
    expect(themePreferenceLabel('light')).toBe('Claro');
    expect(themePreferenceLabel('dark')).toBe('Oscuro');
  });

  it('leaves no option without a label', () => {
    // The account row shows this string. An option added later without one
    // would render blank rather than fail, so the check lives here.
    for (const option of THEME_PREFERENCE_OPTIONS) {
      expect(themePreferenceLabel(option).length).toBeGreaterThan(0);
    }
  });
});

describe('what the app starts as', () => {
  it('is dark, which is what it has always been', () => {
    // Existing listeners never chose anything. Defaulting to 'system' would
    // repaint the app for everybody whose phone is set to light, which is a
    // change nobody asked for.
    const fallback: ThemePreference = DEFAULT_THEME_PREFERENCE;
    expect(fallback).toBe('dark');
  });
});
