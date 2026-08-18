/**
 * Design tokens for the LU32 Radio app.
 *
 * Palette derived from the Conexion7400 brand logo (assets/logo-app.png): a
 * royal blue wordmark + an azure accent. The UI is dark navy so the azure pops
 * and the orange LU32 station badge (the player artwork) reads as a complement.
 * Every component reads from these tokens, so a brand tweak is a single-file
 * change here, never a hunt through the codebase.
 */

export const colors = {
  primary: '#1C7FD6', // brand blue (Conexion7400 azure) — accents, active tab
  primaryDark: '#16357E', // royal navy (Conexion wordmark) — artwork bg, pressed
  background: '#0B1426', // dark navy
  surface: '#13213B', // navy surface — tab bar, cards, mini-player
  text: '#FFFFFF',
  textMuted: '#98A6C2', // blue-grey
  border: '#26365B', // navy border
  error: '#FF5A5F',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 14, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '400' },
} as const;

export const theme = { colors, spacing, radius, typography } as const;
export type Theme = typeof theme;
export type TypographyVariant = keyof typeof typography;
