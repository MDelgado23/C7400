/**
 * The theme, as the rest of the app sees it.
 *
 * NOTE WHAT IS NOT EXPORTED HERE: a `colors` constant.
 *
 * It used to be, and every component imported it at module scope to build a
 * `StyleSheet.create({...})` at module scope too. That is exactly what made a
 * runtime theme impossible: those sheets are evaluated ONCE, when the module is
 * first imported, and they keep whatever palette was current at that instant
 * forever. Toggling the theme could not have moved them.
 *
 * So the constant is gone rather than left lying around next to the hook. Not
 * for tidiness — because the two would look interchangeable at a glance, and
 * the wrong one fails SILENTLY: the screen simply never repaints, and it takes
 * somebody flipping the toggle on that exact screen to notice.
 *
 * Colours come from `useColors()` or `useThemedStyles()`. Sizes still come from
 * constants, because a light theme changes what the app is made of, not how big
 * it is.
 */

export {
  palettes,
  spacing,
  radius,
  typography,
  type Palette,
  type TypographyVariant,
} from './tokens';

export {
  useColors,
  useThemePreference,
  useThemeHydrated,
  useThemeScheme,
  useThemedStyles,
} from './useTheme';

export type { ColorScheme, ThemePreference } from '../../core/theme/themePreference';
