import type { Sponsor } from '../../core/sponsors/sponsor';

/**
 * The shape of the sponsors grid — PURE.
 *
 * THREE COLUMNS, AND AS MANY ROWS AS THE SCREEN HAS ROOM FOR.
 *
 * The columns are fixed because they are what sets the width of a tile. The
 * ROWS are not: a 3x3 that looks right on one phone leaves a third of a taller
 * one empty, and a fixed count can only ever be correct on the device it was
 * chosen on. So the rows are derived from the measured height, the tiles are
 * stretched to meet it exactly, and the section fills whatever screen it lands
 * on — five rows here, four on something shorter, six on something longer.
 *
 * Everything is arithmetic on a measured box, which is why it lives here and
 * not in the component: a short screen, an unmeasured frame, a list of five are
 * each a sentence in a test rather than a device to go and borrow.
 */

export const GRID_COLUMNS = 3;

/**
 * Rows to assume before anything has been measured, and the floor afterwards.
 * Three is the shape the section was designed around, so a first frame drawn
 * with it is never wildly wrong.
 */
export const GRID_FALLBACK_ROWS = 3;

/**
 * Shortest plate worth drawing.
 *
 * Below this the grid stops shrinking and is allowed to overflow instead. A
 * screen of unreadable stamps serves nobody — least of all the businesses
 * paying to be one of them — so where three legible rows will not fit,
 * scrolling is the better failure.
 */
export const MIN_PLATE_HEIGHT = 56;

/** Space between tiles. */
export const GRID_GAP = 8;
/** Padding the scroll content sits inside, on each edge. */
export const GRID_CONTENT_PADDING = 16;
/** Tile padding on each side. */
const TILE_PADDING = 8;
/** Space under the plate: the inner gap plus one line of the sponsor's name. */
const LABEL_BLOCK = 4 + 16;

export type GridSlot =
  | { kind: 'sponsor'; sponsor: Sponsor }
  | { kind: 'empty'; key: string };

/**
 * PURE. The tiles to draw, padded out to a full screen.
 *
 * Padding stops at `minSlots`, which the caller computes from the rows that
 * actually fit. Past that the holes would sit below the fold, where they would
 * only be empty space somebody had to scroll to find.
 */
export function gridSlots(sponsors: Sponsor[], minSlots: number): GridSlot[] {
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
  /** May be infinite on the first frame, before the height is known. */
  height: number;
}

export interface GridMetrics {
  /** Width of one tile, including its own padding. */
  tileWidth: number;
  /** Height of one tile. Rows of these fill the box exactly. */
  tileHeight: number;
  /** Height of the plate the logo is drawn on. It spans the tile's full width. */
  plateHeight: number;
  /** How many rows fit. Times the columns, this is the slot count to fill. */
  rows: number;
}

/**
 * PURE. How the grid divides up the measured box.
 *
 * THE PLATE IS NOT SQUARE, and that is the point rather than a compromise. Once
 * the rows are stretched to fill the height, a tile is a little shorter than it
 * is wide — so the plate spans the tile's full WIDTH and takes whatever height
 * is left. A wide wordmark, which is what most businesses actually hand over,
 * then uses the whole plate instead of shrinking to fit a square; a square logo
 * simply centres itself. Both are drawn with `contain`, so neither distorts.
 *
 * An unmeasured box yields zeroes rather than a guess, and the caller draws
 * nothing for that frame instead of a wrong size that visibly snaps into place.
 */
export function gridMetrics({ width, height }: GridBox): GridMetrics {
  const empty = { tileWidth: 0, tileHeight: 0, plateHeight: 0, rows: GRID_FALLBACK_ROWS };
  if (!(width > 0)) return empty;

  const innerWidth = width - GRID_CONTENT_PADDING * 2;
  if (innerWidth <= 0) return empty;

  const tileWidth = (innerWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  // The tile the section was designed around: a square plate, plus the name.
  const idealTileHeight = tileWidth + LABEL_BLOCK;

  const innerHeight = height - GRID_CONTENT_PADDING * 2;
  if (!Number.isFinite(innerHeight) || innerHeight <= 0) {
    return {
      tileWidth,
      tileHeight: idealTileHeight,
      plateHeight: Math.max(tileWidth - TILE_PADDING * 2, MIN_PLATE_HEIGHT),
      rows: GRID_FALLBACK_ROWS,
    };
  }

  // ROUNDED UP, so the rows always add up to more than the box and are then
  // stretched DOWN to meet it exactly. Rounding to nearest would sometimes land
  // short and leave the strip of dead space this whole function exists to
  // remove. The cost is bounded: one extra row among n shrinks a tile by at
  // most n/(n+1), so about a fifth in the worst case.
  const rows = Math.max(
    1,
    Math.ceil((innerHeight + GRID_GAP) / (idealTileHeight + GRID_GAP)),
  );
  const tileHeight = (innerHeight - GRID_GAP * (rows - 1)) / rows;

  return {
    tileWidth,
    tileHeight,
    plateHeight: Math.max(tileHeight - TILE_PADDING * 2 - LABEL_BLOCK, MIN_PLATE_HEIGHT),
    rows,
  };
}
