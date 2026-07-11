/**
 * Design tokens for the LU32 Radio app.
 *
 * NOTE: this is a PLACEHOLDER palette. Replace with the official LU32 brand
 * assets (colors, fonts) once the client provides them — tracked as an open
 * question in the design. Every component reads from these tokens, so a brand
 * swap is a single-file change here, never a hunt through the codebase.
 */

export const colors = {
  primary: '#D32027', // radio red (placeholder)
  primaryDark: '#8E1519',
  background: '#0E0E10',
  surface: '#1B1B1F',
  text: '#FFFFFF',
  textMuted: '#A0A0A8',
  border: '#2A2A30',
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
