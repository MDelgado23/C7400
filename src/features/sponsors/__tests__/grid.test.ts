import {
  GRID_COLUMNS,
  GRID_CONTENT_PADDING,
  GRID_GAP,
  GRID_MIN_SLOTS,
  MIN_LOGO_SIDE,
  gridMetrics,
  gridSlots,
} from '../grid';
import type { Sponsor } from '../../../core/sponsors/sponsor';

function sponsorsOf(count: number): Sponsor[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `s${index + 1}`,
    name: `Sponsor ${index + 1}`,
    logoUrl: `https://cdn/${index + 1}.png`,
  }));
}

describe('gridSlots', () => {
  // The grid is a 3x3 that is always WHOLE: a radio with five sponsors shows
  // five logos and four quiet holes, not a ragged half-screen.
  it('pads a short list up to nine slots', () => {
    const slots = gridSlots(sponsorsOf(5));

    expect(slots).toHaveLength(9);
    expect(slots.slice(0, 5).map((slot) => slot.kind)).toEqual(Array(5).fill('sponsor'));
    expect(slots.slice(5).map((slot) => slot.kind)).toEqual(Array(4).fill('empty'));
  });

  it('keeps the sponsors in the order they were given', () => {
    const slots = gridSlots(sponsorsOf(4));

    expect(
      slots.filter((slot) => slot.kind === 'sponsor').map((slot) => slot.sponsor.id),
    ).toEqual(['s1', 's2', 's3', 's4']);
  });

  it.each([1, 2, 5, 8])('pads %i sponsors to nine', (count) => {
    expect(gridSlots(sponsorsOf(count))).toHaveLength(GRID_MIN_SLOTS);
  });

  it('pads nothing when there are exactly nine', () => {
    const slots = gridSlots(sponsorsOf(9));

    expect(slots).toHaveLength(9);
    expect(slots.every((slot) => slot.kind === 'sponsor')).toBe(true);
  });

  // Past nine the padding has done its job: those slots are below the fold, so
  // rounding the last row out with holes would only invent empty space nobody
  // asked to scroll to.
  it.each([10, 12, 17])('leaves %i sponsors exactly as they are', (count) => {
    const slots = gridSlots(sponsorsOf(count));

    expect(slots).toHaveLength(count);
    expect(slots.every((slot) => slot.kind === 'sponsor')).toBe(true);
  });

  it('gives every empty slot a key of its own, so React can tell them apart', () => {
    const keys = gridSlots(sponsorsOf(2))
      .filter((slot) => slot.kind === 'empty')
      .map((slot) => slot.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is three columns wide', () => {
    expect(GRID_COLUMNS).toBe(3);
    expect(GRID_MIN_SLOTS).toBe(GRID_COLUMNS * 3);
  });
});

describe('gridMetrics', () => {
  /**
   * What onLayout actually reports: the OUTER box, padding included. The Moto
   * G35 is 432dp across, and the section gets ~776dp of it once the tab bar,
   * mini-player and heading have taken theirs.
   */
  const MOTO = { width: 432, height: 776 };
  /**
   * A box short enough that the height runs out first — a small screen with the
   * system font scaled up, or any future chrome that eats into the section.
   *
   * Worth stating plainly: on the phones modelled so far the WIDTH is what
   * binds, by a hair. This clamp is not fixing a bug that was about to ship; it
   * is what makes "all nine are visible" a guarantee rather than a bet on every
   * screen being tall enough.
   */
  const SHORT = { width: 320, height: 332 };

  it('divides the width into three columns with the gaps taken out', () => {
    const { tileWidth } = gridMetrics(MOTO);

    // (432 - 2 paddings of 16 - 2 gaps of 8) / 3
    expect(tileWidth).toBeCloseTo(128, 0);
  });

  /**
   * THE ONE THAT WOULD HAVE CAUGHT THE TWO-COLUMN BUG.
   *
   * The first version took the box the caller happened to pass and trusted it.
   * The caller passed what onLayout reports — the scroll view's OWN width —
   * while the tiles live inside the content padding, so three tiles came out
   * 16dp too wide between them, wrapped to two per row, and every unit test
   * still passed because the arithmetic was never wrong: the INPUT was.
   *
   * Owning the padding here is what makes this assertion possible at all.
   */
  it.each([320, 360, 412, 432, 480])(
    'fits three tiles and their gaps inside a %idp screen',
    (width) => {
      const { tileWidth } = gridMetrics({ width, height: 776 });
      const row = tileWidth * GRID_COLUMNS + GRID_GAP * (GRID_COLUMNS - 1);

      expect(row).toBeLessThanOrEqual(width - GRID_CONTENT_PADDING * 2 + 0.001);
    },
  );

  describe('which constraint binds', () => {
    // Every roomy phone: three columns is what limits the tile, and the grid
    // sits in the upper part of the screen with air below it.
    it('is limited by the width on a tall screen', () => {
      const { logoSide, tileWidth } = gridMetrics(MOTO);

      expect(logoSide).toBeCloseTo(tileWidth - 16, 0);
    });

    // The width would allow a 75dp logo here, but three rows of that do not
    // fit — and the ninth sponsor would fall below the fold on the one section
    // whose whole point is that all nine are visible at once.
    it('is limited by the height on a short screen', () => {
      const { logoSide, tileWidth } = gridMetrics(SHORT);

      expect(logoSide).toBeLessThan(tileWidth - 16);
    });

    it('fits three rows inside the height it was given', () => {
      const { logoSide } = gridMetrics(SHORT);
      const chrome = 16 + 4 + 16; // tile padding + inner gap + label
      const inner = SHORT.height - GRID_CONTENT_PADDING * 2;

      expect((logoSide + chrome) * 3 + GRID_GAP * 2).toBeLessThanOrEqual(inner + 1);
    });
  });

  describe('degenerate boxes', () => {
    // The first frame, before onLayout has measured anything.
    it.each([
      ['unmeasured', { width: 0, height: 0 }],
      ['negative', { width: -100, height: -100 }],
    ])('never returns a negative size for a %s box', (_label, box) => {
      const { tileWidth, logoSide } = gridMetrics(box);

      expect(tileWidth).toBeGreaterThanOrEqual(0);
      expect(logoSide).toBeGreaterThanOrEqual(0);
    });

    // A logo shrunk past legibility helps nobody: better to overflow the box
    // and let the section scroll than to draw nine unreadable stamps.
    it('stops shrinking at a legible floor', () => {
      const { logoSide } = gridMetrics({ width: 400, height: 120 });

      expect(logoSide).toBe(MIN_LOGO_SIDE);
    });
  });

  it('grows the tile on a wider screen', () => {
    const small = gridMetrics({ width: 320, height: 776 });
    const large = gridMetrics({ width: 480, height: 776 });

    expect(large.logoSide).toBeGreaterThan(small.logoSide);
  });
});
