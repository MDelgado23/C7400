import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME_PREFERENCE_KEY, asyncStorageThemeStore } from '../asyncStorageThemeStore';
import {
  __resetTheme,
  getThemePreference,
  hasHydratedTheme,
  setThemePreference,
  setThemeStore,
} from '../themeService';
import { DEFAULT_THEME_PREFERENCE } from '../themePreference';

/** Lets the store promises settle. Hydration is async by nature. */
const settle = () => new Promise<void>((resolve) => { setImmediate(() => resolve()); });

beforeEach(async () => {
  __resetTheme();
  await AsyncStorage.clear();
});

afterEach(__resetTheme);

// Exercised THROUGH the port, because the seam that matters is the one the app
// actually uses: a launch saves a choice and the NEXT launch has to open on it,
// before the splash lifts and without the network being involved.
describe('asyncStorageThemeStore, through the port', () => {
  it('opens the next launch on what the last one chose', async () => {
    setThemeStore(asyncStorageThemeStore);
    await settle();
    setThemePreference('light');
    await settle();

    __resetTheme();
    setThemeStore(asyncStorageThemeStore);
    await settle();

    expect(getThemePreference()).toBe('light');
  });

  it('opens on the default before anybody has ever chosen', async () => {
    setThemeStore(asyncStorageThemeStore);
    await settle();

    expect(getThemePreference()).toBe(DEFAULT_THEME_PREFERENCE);
    expect(hasHydratedTheme()).toBe(true);
  });

  it('remembers automatic as a choice like any other', async () => {
    // 'system' is a REAL preference, not the absence of one. Storing it as empty
    // would have the next launch open on dark for somebody who asked to follow
    // their phone.
    setThemeStore(asyncStorageThemeStore);
    await settle();
    setThemePreference('system');
    await settle();

    __resetTheme();
    setThemeStore(asyncStorageThemeStore);
    await settle();

    expect(getThemePreference()).toBe('system');
  });

  it('overwrites rather than accumulating choices', async () => {
    setThemeStore(asyncStorageThemeStore);
    await settle();
    setThemePreference('light');
    setThemePreference('dark');
    await settle();

    await expect(AsyncStorage.getItem(THEME_PREFERENCE_KEY)).resolves.toBe('dark');
  });

  it('opens on the default when the stored value came from another build', async () => {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, 'Oscuro');

    setThemeStore(asyncStorageThemeStore);
    await settle();

    expect(getThemePreference()).toBe(DEFAULT_THEME_PREFERENCE);
  });

  it('stores the choice under one versioned key', async () => {
    // The version is what lets a future change of vocabulary abandon the old
    // value in one edit, instead of shipping a migration for eight bytes.
    setThemeStore(asyncStorageThemeStore);
    await settle();
    setThemePreference('light');
    await settle();

    await expect(AsyncStorage.getAllKeys()).resolves.toEqual([THEME_PREFERENCE_KEY]);
    expect(THEME_PREFERENCE_KEY).toMatch(/\.v\d+$/);
  });

  it('stores it as a plain string, with no JSON around it', async () => {
    // One short string needs no wrapper, and a wrapper is one more way for a
    // cold boot to throw before the splash lifts.
    setThemeStore(asyncStorageThemeStore);
    await settle();
    setThemePreference('light');
    await settle();

    await expect(AsyncStorage.getItem(THEME_PREFERENCE_KEY)).resolves.toBe('light');
  });
});
