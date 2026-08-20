import type { Sponsor } from '../../core/sponsors/sponsor';

/**
 * The shape of the sponsors grid — PURE.
 *
 * Two rules live here, and both exist because of the same product decision:
 * THE FIRST SCREEN IS ALWAYS A WHOLE 3x3.
 *
 * 1. A short list is padded with quiet holes, so five sponsors read as "five of
 *    nine places taken" rather than as a section that ran out halfway down.
 * 2. The tile is sized against BOTH the width and the height of whatever box it
 *    was given, so nine slots fit on a small phone as surely as on a big one.
 *
 * Kept out of the component because the interesting cases are all arithmetic —
 * a short screen, an unmeasured box, a list of five — and each one is a sentence
 * here instead of a device to go and find.
 */

export const GRID_COLUMNS = 3;
export const GRID_ROWS = 3;
/** The slots that must be filled before anything is allowed to scroll. */
export const GRID_MIN_SLOTS = GRID_COLUMNS * GRID_ROWS;

/**
 * Smallest logo worth drawing.
 *
 * Below this the grid stops shrinking and is allowed to overflow instead. Nine
 * unreadable stamps serve nobody — least of all the businesses paying to be
 * one of them — so on a screen too short to hold three legible rows, scrolling
 * is the better failure.
 */
export const MIN_LOGO_SIDE = 56;

export type GridSlot =
  | { kind: 'sponsor'; sponsor: Sponsor }
  | { kind: 'empty'; key: string };

/**
 * PURE. The tiles to draw, padded to a full first screen.
 *
 * Padding stops at `minSlots`. Past that the holes would sit below the fold,
 * where they would only be empty space somebody had to scroll to find.
 */
export function gridSlots(sponsors: Sponsor[], minSlots: number = GRID_MIN_SLOTS): GridSlot[] {
  const slots: GridSlot[] = sponsors.map((sponsor) => ({ kind: 'sponsor', sponsor }));
  for (let index = slots.length; index < minSlots; index += 1) {
    // Indexed rather than positional: React needs these to be stable and
    // distinct from one another across re-renders.
    slots.push({ kind: 'empty', key: `empty-${index}` });
  }
  return slots;
}

interface GridBox {
  /**
   * The OUTER box, exactly as `onLayout` reports it — the scroll view's own
   * size, with the content padding still inside it.
   *
   * Taking the outer box rather than a pre-trimmed one is deliberate. When the
   * caller was trusted to subtract the padding first, it passed the raw layout
   * instead, three tiles came out 16dp too wide between them and wrapped to two
   * per row — and every unit test still passed, because the arithmetic here was
   * never wrong. The input was. Owning the padding removes the chance.
   */
  width: number;
  height: number;
}

export interface GridMetrics {
  /** Width of one tile, including its own padding. */
  tileWidth: number;
  /** Side of the square logo inside a tile. */
  logoSide: number;
}

/** Space between tiles. */
export const GRID_GAP = 8;
/** Padding the scroll content sits inside, on each edge. */
export const GRID_CONTENT_PADDING = 16;
/** Tile padding on each side. */
const TILE_PADDING = 8;
/** Space under the logo: the inner gap plus one line of the sponsor's name. */
const LABEL_BLOCK = 4 + 16;

/**
 * PURE. How big a tile can be inside the measured box.
 *
 * THE HEIGHT IS A REAL CONSTRAINT, NOT A FORMALITY. Sizing on width alone looks
 * correct on every phone anyone tests on, and then fails on the short ones: a
 * 320x568 screen has room for a 91dp tile across but only 76dp down, so three
 * rows of the width-derived size push the last row off the screen — on the one
 * section whose whole point is that all nine are visible at once.
 *
 * An unmeasured box (the frame before onLayout reports) yields zero rather than
 * a guess, and the view draws nothing for that frame instead of a wrong size
 * that visibly snaps into place.
 */
export function gridMetrics({ width, height }: GridBox): GridMetrics {
  if (width <= 0 || height <= 0) return { tileWidth: 0, logoSide: 0 };

  // What is left once the content padding has taken its share of both edges.
  const innerWidth = width - GRID_CONTENT_PADDING * 2;
  const innerHeight = height - GRID_CONTENT_PADDING * 2;
  if (innerWidth <= 0 || innerHeight <= 0) return { tileWidth: 0, logoSide: 0 };

  const tileWidth = (innerWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const tileHeight = (innerHeight - GRID_GAP * (GRID_ROWS - 1)) / GRID_ROWS;

  const byWidth = tileWidth - TILE_PADDING * 2;
  const byHeight = tileHeight - TILE_PADDING * 2 - LABEL_BLOCK;

  return {
    tileWidth: Math.max(tileWidth, 0),
    // Whichever runs out first decides, with a floor under both — see MIN_LOGO_SIDE.
    logoSide: Math.max(Math.min(byWidth, byHeight), MIN_LOGO_SIDE),
  };
}
