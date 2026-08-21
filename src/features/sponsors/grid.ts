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
 * The shape of the artwork sponsors are asked for: 640x512.
 *
 * THE PLATE IS BUILT TO THIS, and that is what stops the logos being padded. A
 * logo drawn with `contain` on a plate of any other shape is letterboxed, and
 * the bars are plate — which is exactly how a black line came to sit above and
 * below every white logo the moment the light theme existed. Give the plate the
 * artwork's own aspect and there is nothing left to fill: `contain` and `cover`
 * agree, so nothing is padded and nothing is cropped.
 *
 * A file that does NOT meet the spec still centres safely rather than
 * distorting — it is simply the one case where a sliver of plate shows, which
 * is why the plate is white rather than a themed colour.
 */
export const LOGO_ASPECT = 640 / 512;

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
  /**
   * The plate the logo is drawn on. ALWAYS `LOGO_ASPECT`, and both sides are
   * reported because the caller has to set both: a plate that took its width
   * from the tile and only its height from here would be back to whatever
   * shape the screen happened to leave.
   */
  plateWidth: number;
  plateHeight: number;
  /** How many rows fit. Times the columns, this is the slot count to fill. */
  rows: number;
}

/**
 * The largest `LOGO_ASPECT` rectangle that fits in a box — PURE.
 *
 * Width-led, because the tile's width is the fixed dimension and its height is
 * whatever the stretched rows left over. When the leftover height is the tighter
 * constraint the plate shrinks to it and gives the width back, so it never
 * spills over the sponsor's name.
 */
function fitPlate(maxWidth: number, maxHeight: number): { width: number; height: number } {
  const height = Math.max(Math.min(maxHeight, maxWidth / LOGO_ASPECT), MIN_PLATE_HEIGHT);
  return { width: Math.min(height * LOGO_ASPECT, maxWidth), height };
}

/**
 * PURE. How the grid divides up the measured box.
 *
 * THE PLATE IS NOT SQUARE, and that is the point rather than a compromise: it
 * carries `LOGO_ASPECT`, the shape of the artwork itself. The tiles still
 * stretch to fill the measured height — that is what keeps the section from
 * leaving a dead strip — but the plate no longer inherits whatever shape the
 * stretch produced. It takes the largest 640x512 rectangle that fits inside the
 * tile, so a compliant logo is drawn edge to edge with nothing padded, and any
 * height the plate does not use stays as tile.
 *
 * An unmeasured box yields zeroes rather than a guess, and the caller draws
 * nothing for that frame instead of a wrong size that visibly snaps into place.
 */
export function gridMetrics({ width, height }: GridBox): GridMetrics {
  const empty = {
    tileWidth: 0,
    tileHeight: 0,
    plateWidth: 0,
    plateHeight: 0,
    rows: GRID_FALLBACK_ROWS,
  };
  if (!(width > 0)) return empty;

  const innerWidth = width - GRID_CONTENT_PADDING * 2;
  if (innerWidth <= 0) return empty;

  const tileWidth = (innerWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const maxPlateWidth = tileWidth - TILE_PADDING * 2;

  // The tile the section was designed around: a square plate, plus the name.
  const idealTileHeight = tileWidth + LABEL_BLOCK;

  const innerHeight = height - GRID_CONTENT_PADDING * 2;
  if (!Number.isFinite(innerHeight) || innerHeight <= 0) {
    // Height unknown, so the width is the only constraint there is.
    const plate = fitPlate(maxPlateWidth, Number.POSITIVE_INFINITY);
    return {
      tileWidth,
      tileHeight: idealTileHeight,
      plateWidth: plate.width,
      plateHeight: plate.height,
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

  // The plate takes the artwork's shape inside whatever the stretched tile
  // leaves. Any height the plate does not use stays as tile — same colour as
  // the card it sits on, so it reads as breathing room rather than a band.
  const plate = fitPlate(maxPlateWidth, tileHeight - TILE_PADDING * 2 - LABEL_BLOCK);

  return {
    tileWidth,
    tileHeight,
    plateWidth: plate.width,
    plateHeight: plate.height,
    rows,
  };
}
