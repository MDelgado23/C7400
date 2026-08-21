import { palettes, type Palette } from '../tokens';

/**
 * WCAG 2.1 relative luminance of a `#rrggbb` colour.
 *
 * Lives in the test rather than in the app because nothing at runtime needs it:
 * the palettes are constants, so the only moment this question can be answered
 * usefully is the moment somebody edits one.
 */
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two `#rrggbb` colours. 1 (none) to 21 (max). */
function contrast(a: string, b: string): number {
  const [bright, dim] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (bright + 0.05) / (dim + 0.05);
}

type Pair = readonly [keyof Palette, keyof Palette];

/**
 * PROSE. Paragraphs, labels, error messages — read at length, at 12–16px, on a
 * phone held in the sun. WCAG AA for body text is 4.5:1 and there is no room to
 * argue about it.
 */
const PROSE_PAIRS: readonly Pair[] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['error', 'background'],
  ['error', 'surface'],
];

/**
 * ACCENTS. Button labels on a brand fill, icons, the active tab.
 *
 * Held to 3:1 — WCAG's threshold for UI components and large text — and NOT to
 * 4.5, for one honest reason: the dark palette shipped a long time ago and its
 * brand blue sits at 4.15:1 under white. Raising the bar here would fail the
 * theme every existing listener is already using, and the fix would be to
 * silently redesign it. That is a decision to take deliberately, in daylight,
 * not something to smuggle in with a light theme.
 *
 * The light palette is built to clear 4.5 on these anyway. It had the luxury of
 * being designed after the question was asked.
 */
const ACCENT_PAIRS: readonly Pair[] = [
  ['onPrimary', 'primary'],
  ['onPrimary', 'primaryDark'],
  ['primary', 'background'],
  ['primary', 'surface'],
  // The play/pause affordance, in both of the ways it is drawn: as a bare glyph
  // on the mini bar, and as the fill of the big round button with a white icon
  // over it. Both have to hold or the one control that matters is unusable.
  ['control', 'surface'],
  ['control', 'background'],
  ['onPrimary', 'control'],
];

const SCHEMES = ['dark', 'light'] as const;

/** Every ratio in the group, named, so a failure says which pair broke. */
function ratios(scheme: (typeof SCHEMES)[number], pairs: readonly Pair[]) {
  return pairs.map(([foreground, backdrop]) => {
    const value = contrast(palettes[scheme][foreground], palettes[scheme][backdrop]);
    return { pair: `${foreground} on ${backdrop}`, value };
  });
}

describe('the two palettes', () => {
  it('carry exactly the same tokens', () => {
    // A component reads one name and gets whichever palette is active. A token
    // present in only one of them renders as `undefined` in the other, which
    // React Native does not complain about — it just paints nothing.
    expect(Object.keys(palettes.light).sort()).toEqual(Object.keys(palettes.dark).sort());
  });

  it('give every token a real colour', () => {
    for (const scheme of SCHEMES) {
      for (const [token, value] of Object.entries(palettes[scheme])) {
        expect(`${scheme}.${token}=${value}`).toMatch(/=(#[0-9a-fA-F]{6}|rgba\()/);
      }
    }
  });

  it('are actually different from each other', () => {
    // The whole point. A copy-pasted palette would pass every other check here.
    expect(palettes.light.background).not.toBe(palettes.dark.background);
    expect(palettes.light.text).not.toBe(palettes.dark.text);
  });
});

describe('what the dark palette was', () => {
  it('has not moved', () => {
    // Every listener is on this one today. The light theme is an ADDITION, not a
    // repaint of what people already have, and a drifted value here would be a
    // redesign shipped by accident.
    expect(palettes.dark).toMatchObject({
      primary: '#1C7FD6',
      primaryDark: '#16357E',
      background: '#0B1426',
      surface: '#13213B',
      text: '#FFFFFF',
      textMuted: '#98A6C2',
      border: '#26365B',
      error: '#FF5A5F',
      // The play control. Added with the light theme and set to the blue the
      // dark palette was ALREADY drawing, so the theme every listener has today
      // is byte-identical to what it was.
      control: '#1C7FD6',
    });
  });
});

describe('the play control colour', () => {
  /*
   * The one token whose two values are a deliberate DIVERGENCE rather than the
   * same idea re-tuned.
   *
   * In the light theme it is the wordmark navy, the same `#16357E` that wraps
   * the station logo — asked for by name, and it reads at better than 11:1 on
   * white. In the dark theme that navy is unusable: the surface there IS navy,
   * so `#16357E` on `#13213B` measures 1.41:1 and the button simply is not
   * there. There is no "darker blue" available to a theme whose ground is
   * already dark, so dark keeps the lighter brand blue.
   */
  it('is the wordmark navy in the light theme', () => {
    expect(palettes.light.control).toBe('#16357E');
    expect(palettes.light.control).toBe(palettes.light.primaryDark);
  });

  it('leaves the dark theme exactly where it was', () => {
    expect(palettes.dark.control).toBe(palettes.dark.primary);
  });

  it('would be invisible if the light value were used in the dark theme', () => {
    // The measurement the decision rests on, kept executable so nobody has to
    // take it on trust — or quietly "unify" the token later.
    expect(contrast(palettes.light.control, palettes.dark.surface)).toBeLessThan(1.5);
  });
});

describe('readability', () => {
  it.each(SCHEMES)('holds AA for prose in the %s palette', (scheme) => {
    for (const { pair, value } of ratios(scheme, PROSE_PAIRS)) {
      // Asserted as a string so the message names the pair and the ratio
      // instead of just "expected 4.31 to be at least 4.5".
      expect(`${pair}: ${value.toFixed(2)}`).toBe(`${pair}: ${Math.max(value, 4.5).toFixed(2)}`);
    }
  });

  it.each(SCHEMES)('holds the accent floor in the %s palette', (scheme) => {
    for (const { pair, value } of ratios(scheme, ACCENT_PAIRS)) {
      expect(`${pair}: ${value.toFixed(2)}`).toBe(`${pair}: ${Math.max(value, 3).toFixed(2)}`);
    }
  });

  it('clears the prose bar on accents too, in light, because it can', () => {
    // Documents the deliberate asymmetry above. If somebody later fixes the dark
    // brand blue, this expectation is the one to widen to both schemes.
    for (const { pair, value } of ratios('light', ACCENT_PAIRS)) {
      expect(`${pair}: ${value.toFixed(2)}`).toBe(`${pair}: ${Math.max(value, 4.5).toFixed(2)}`);
    }
  });

  it.each(SCHEMES)('keeps surfaces distinguishable from the page in %s', (scheme) => {
    // Cards, the tab bar and the mini-player are surfaces sitting ON the
    // background. Identical values flatten the app into one sheet — a real risk
    // in light mode, where both want to be nearly white.
    expect(palettes[scheme].surface).not.toBe(palettes[scheme].background);
  });

  it.each(SCHEMES)('keeps borders visible against their surface in %s', (scheme) => {
    expect(contrast(palettes[scheme].border, palettes[scheme].surface)).toBeGreaterThan(1.1);
  });
});
