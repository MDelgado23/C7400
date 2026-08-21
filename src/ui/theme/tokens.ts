/**
 * Design tokens for the LU32 Radio app.
 *
 * Palette derived from the Conexion7400 brand logo (assets/logo-app.png): a
 * royal blue wordmark + an azure accent.
 *
 * TWO PALETTES, ONE VOCABULARY. Components never name a colour, they name a
 * ROLE — `surface`, `textMuted`, `onPrimary` — and the active palette decides
 * what that role looks like. Which is why the two must always carry the same
 * keys: a token that exists in only one of them renders as `undefined` in the
 * other, and React Native paints nothing rather than complaining.
 *
 * These are plain data, on purpose. NOTHING should import them directly to
 * style a component — read the active one through `useColors()`, or the styles
 * freeze on whichever palette happened to be loaded first and the theme toggle
 * does nothing. They are exported for the provider, for the tests, and for the
 * navigation containers that need to build a theme object.
 *
 * Everything else here — spacing, radius, typography — is scheme-independent by
 * design. A light theme changes what the app is made of, not how big it is.
 */

/** The roles a palette has to fill. */
export interface Palette {
  /** Brand accent: active tab, links, primary fills. */
  primary: string;
  /** Deeper brand navy: artwork backdrop, pressed and busy states. */
  primaryDark: string;
  /**
   * The play/pause affordance — the mini bar's bare glyph and the fill of the
   * big round button on Radio.
   *
   * ITS TWO VALUES DIVERGE ON PURPOSE, which is why it is a token of its own
   * rather than a reference to one of the blues above. In the light theme it is
   * the wordmark navy that wraps the station logo. In the dark theme that navy
   * cannot be used at all: the surface there IS navy, so it measures 1.41:1 and
   * the control disappears. A theme whose ground is already dark has no darker
   * blue to offer, so it keeps the lighter brand one — unchanged from what it
   * has always drawn.
   */
  control: string;
  /** Content sitting ON a primary or primaryDark fill. */
  onPrimary: string;
  /** The page itself. */
  background: string;
  /** Anything raised off the page: cards, tab bar, mini-player, rows. */
  surface: string;
  /** Body text. */
  text: string;
  /** Secondary text: captions, timestamps, inactive tabs. */
  textMuted: string;
  /** Hairlines and dividers. */
  border: string;
  /** Destructive and failed states. */
  error: string;
  /** The faint ring behind the spinner's bright arc. Translucent by nature. */
  spinnerTrack: string;
}

/**
 * The theme the app has always had, UNCHANGED.
 *
 * Every listener is on this one today, so it is deliberately left exactly where
 * it was. The light theme is an addition; this is not the moment to also
 * redesign what people already opened the app expecting.
 */
const dark: Palette = {
  primary: '#1C7FD6', // brand blue (Conexion7400 azure) — accents, active tab
  primaryDark: '#16357E', // royal navy (Conexion wordmark) — artwork bg, pressed
  control: '#1C7FD6', // the blue this theme has always drawn the play button in
  onPrimary: '#FFFFFF',
  background: '#0B1426', // dark navy
  surface: '#13213B', // navy surface — tab bar, cards, mini-player
  text: '#FFFFFF',
  textMuted: '#98A6C2', // blue-grey
  border: '#26365B', // navy border
  error: '#FF5A5F',
  spinnerTrack: 'rgba(255, 255, 255, 0.25)',
};

/**
 * The same brand, in daylight. NOT an inversion of the palette above.
 *
 * Two values had to change rather than flip, and both for the same reason —
 * contrast is not symmetric. A colour that reads on navy can be invisible on
 * white:
 *
 * - PRIMARY drops from #1C7FD6 to #1565C0. The azure hits only 4.15:1 against
 *   white, which fails AA for a button label. #1565C0 is that same blue pulled
 *   toward the wordmark navy — still unmistakably the brand — and it clears
 *   5.7:1, so the "Guardar" button is legible with the brightness down.
 *
 * - ERROR drops from #FF5A5F to #C62828. The bright coral manages 2.9:1 on
 *   white. An error message nobody can read is worse than no error message,
 *   because the user thinks the tap did nothing.
 *
 * BACKGROUND IS NOT PURE WHITE, and surface is. That is the inverse of the dark
 * palette's relationship (where surface is lighter than the page) and it is the
 * right one for daylight: cards have to lift OFF the page, and on a pure-white
 * page a white card is invisible without drawing a border around everything.
 */
const light: Palette = {
  primary: '#1565C0', // brand azure, deepened until it reads on white
  primaryDark: '#16357E', // the wordmark navy, unchanged — it works on both
  control: '#16357E', // the play button IS the wordmark navy here: 11.4:1 on white
  onPrimary: '#FFFFFF',
  background: '#F4F6FB', // barely-blue paper, so surfaces can be white
  surface: '#FFFFFF', // cards, tab bar, mini-player, rows
  text: '#0B1426', // the dark palette's background, reading as near-black
  textMuted: '#55658A', // blue-grey, dark enough for AA on both paper and card
  border: '#D5DDEA', // light blue-grey hairline
  error: '#C62828',
  spinnerTrack: 'rgba(11, 20, 38, 0.18)',
};

/** Both palettes, keyed by the scheme that selects them. */
export const palettes = { dark, light } as const;

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

export type TypographyVariant = keyof typeof typography;
