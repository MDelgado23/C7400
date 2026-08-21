import { useCallback } from 'react';
import { ThemeView } from './ThemeView';
import { useThemePreference } from '../../ui/theme';
import { setThemePreference } from '../../core/theme/themeService';
import type { ThemePreference } from '../../core/theme/themePreference';

/**
 * Container for the theme picker.
 *
 * Almost nothing to it, and that is the point: the port already holds the
 * choice, already writes it to the phone and to the account, and already
 * republishes it to every subscriber. There is no local state here to get out of
 * step with any of that — the screen reads the same value it just wrote, from
 * the same place every other screen reads it.
 */
export function ThemeScreen() {
  const preference = useThemePreference();

  const handleSelect = useCallback((next: ThemePreference) => {
    // Not awaited, and it cannot reject. The repaint happens on this frame; the
    // two writes catch their own failures and are reported, never surfaced.
    setThemePreference(next);
  }, []);

  return <ThemeView preference={preference} onSelect={handleSelect} />;
}
