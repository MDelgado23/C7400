import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemePreference } from './themePreference';
import type { ThemeStore } from './themeService';

/**
 * AsyncStorage adapter for the theme port — the phone's copy of the choice.
 *
 * The SECOND consumer of AsyncStorage in the app, alongside the sponsors cache,
 * and the one that file predicted. Everything else talks to `themeService`, so
 * swapping the storage engine is a change confined to this layer.
 *
 * Deliberately thin: it moves a string and does not interpret it. Deciding what
 * a valid preference is belongs in `themePreference`, where the SAME validator
 * is applied to what comes out of the account document — one answer to that
 * question rather than two that can drift apart.
 *
 * The value is stored RAW, not wrapped in JSON. There is nothing to wrap: a
 * preference is one short string, and `JSON.parse` on it is one more way for a
 * cold boot to fail before the splash lifts.
 */

/**
 * Where the choice lives.
 *
 * The trailing version is load-bearing, exactly as in the sponsors cache: if the
 * stored vocabulary ever changes, bumping it abandons the old value in one edit.
 * Abandoning it costs the user one tap, which is cheaper than a migration.
 */
export const THEME_PREFERENCE_KEY = 'lu32.theme.v1';

export const asyncStorageThemeStore: ThemeStore = {
  /**
   * The stored preference, unvalidated.
   *
   * Answers whatever is on disk, including nonsense written by another build.
   * The port validates it and treats anything unrecognised as "nothing stored",
   * which is precisely the right outcome and is not this file's decision to
   * make.
   */
  read(): Promise<unknown> {
    return AsyncStorage.getItem(THEME_PREFERENCE_KEY);
  },

  async write(preference: ThemePreference): Promise<void> {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
  },
};
