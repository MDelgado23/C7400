import {
  GRID_COLUMNS,
  GRID_CONTENT_PADDING,
  GRID_FALLBACK_ROWS,
  GRID_GAP,
  LOGO_ASPECT,
  MIN_PLATE_HEIGHT,
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
  // The screen is always FULL: a radio with five sponsors shows five logos and
  // the rest as quiet holes, not a section that ran out halfway down.
  it('pads a short list up to the slots asked for', () => {
    const slots = gridSlots(sponsorsOf(5), 15);

    expect(slots).toHaveLength(15);
    expect(slots.slice(0, 5).map((slot) => slot.kind)).toEqual(Array(5).fill('sponsor'));
    expect(slots.slice(5).map((slot) => slot.kind)).toEqual(Array(10).fill('empty'));
  });

  it('keeps the sponsors in the order they were given', () => {
    const ids = gridSlots(sponsorsOf(4), 9)
      .filter((slot) => slot.kind === 'sponsor')
      .map((slot) => (slot.kind === 'sponsor' ? slot.sponsor.id : ''));

    expect(ids).toEqual(['s1', 's2', 's3', 's4']);
  });

  it('pads nothing when the slots are exactly taken', () => {
    const slots = gridSlots(sponsorsOf(12), 12);

    expect(slots).toHaveLength(12);
    expect(slots.every((slot) => slot.kind === 'sponsor')).toBe(true);
  });

  // Past the visible slots the padding has done its job: more holes would sit
  // below the fold, where they are only empty space to scroll past.
  it.each([13, 20])('leaves %i sponsors alone when only 12 are visible', (count) => {
    const slots = gridSlots(sponsorsOf(count), 12);

    expect(slots).toHaveLength(count);
    expect(slots.every((slot) => slot.kind === 'sponsor')).toBe(true);
  });

  it('gives every hole a key of its own, so React can tell them apart', () => {
    const keys = gridSlots(sponsorsOf(2), 9)
      .filter((slot) => slot.kind === 'empty')
      .map((slot) => (slot.kind === 'empty' ? slot.key : ''));

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('gridMetrics', () => {
  /**
   * What `onLayout` reports on the Moto G35 the app is tested on: 432dp across,
   * and 693dp of height left once the heading, mini-player, tab bar and system
   * bars have taken theirs. Measured off a screenshot, not guessed.
   */
  const MOTO = { width: 432, height: 693 };

  const innerOf = (box: { width: number; height: number }) => ({
    width: box.width - GRID_CONTENT_PADDING * 2,
    height: box.height - GRID_CONTENT_PADDING * 2,
  });

  describe('the columns', () => {
    it('divides the width into three, with the gaps taken out', () => {
      // (432 - 2 paddings of 16 - 2 gaps of 8) / 3
      expect(gridMetrics(MOTO).tileWidth).toBeCloseTo(128, 0);
    });

    /**
     * THE ONE THAT CAUGHT THE TWO-COLUMN BUG.
     *
     * The first version trusted the box the caller passed. The caller passed
     * what onLayout reports — the scroll view's OWN width — while the tiles live
     * inside the content padding, so three tiles came out 16dp too wide between
     * them, wrapped to two per row, and every unit test still passed because the
     * arithmetic was never wrong: the INPUT was.
     */
    it.each([320, 360, 412, 432, 480])(
      'fits three tiles and their gaps inside a %idp screen',
      (width) => {
        const { tileWidth } = gridMetrics({ width, height: 693 });
        const row = tileWidth * GRID_COLUMNS + GRID_GAP * (GRID_COLUMNS - 1);

        expect(row).toBeLessThanOrEqual(innerOf({ width, height: 0 }).width + 0.001);
      },
    );
  });

  // THE POINT OF THIS MODULE. A fixed 3x3 left a third of this phone empty —
  // 227dp of the 693 it had — because three is only ever the right number on
  // the screen it was chosen on.
  describe('the rows adapt to the screen', () => {
    it('finds five rows on the phone that fitted three', () => {
      expect(gridMetrics(MOTO).rows).toBe(5);
    });

    it.each([
      ['a short screen', { width: 432, height: 420 }],
      ['the test phone', MOTO],
      ['a long screen', { width: 432, height: 900 }],
    ])('fills %s exactly, with no strip left over', (_label, box) => {
      const { rows, tileHeight } = gridMetrics(box);
      const used = tileHeight * rows + GRID_GAP * (rows - 1);

      expect(used).toBeCloseTo(innerOf(box).height, 5);
    });

    it('asks for more rows as the screen gets longer', () => {
      const short = gridMetrics({ width: 432, height: 420 }).rows;
      const long = gridMetrics({ width: 432, height: 900 }).rows;

      expect(long).toBeGreaterThan(short);
    });

    it('never asks for fewer than one row', () => {
      expect(gridMetrics({ width: 432, height: 60 }).rows).toBeGreaterThanOrEqual(1);
    });

    // One extra row among n shrinks a tile by at most n/(n+1), so the tile is
    // never a fraction of what the width would have allowed.
    it('keeps the tile close to the square it was designed as', () => {
      const { tileWidth, tileHeight } = gridMetrics(MOTO);

      expect(tileHeight).toBeGreaterThan(tileWidth * 0.75);
      expect(tileHeight).toBeLessThanOrEqual(tileWidth + 20 + 0.001);
    });
  });

  describe('the plate', () => {
    /*
     * THE PLATE CARRIES THE ARTWORK'S OWN SHAPE, and that is what keeps the
     * logos from being padded.
     *
     * Sponsors hand over 640x512 files. Draw them with `contain` on a plate of
     * any OTHER shape and the difference is filled with plate — which is how a
     * black bar came to sit above and below every white logo in the light
     * theme. Match the shape and there is nothing left to fill: `contain` and
     * `cover` become the same thing, so no logo is padded and none is cropped.
     */
    it('has exactly the artwork aspect on a real phone', () => {
      const { plateWidth, plateHeight } = gridMetrics(MOTO);

      expect(plateWidth / plateHeight).toBeCloseTo(LOGO_ASPECT, 5);
    });

    it.each([
      ['a short screen', { width: 432, height: 420 }],
      ['a tall screen', { width: 432, height: 900 }],
      ['a narrow phone', { width: 320, height: 693 }],
      ['a wide phone', { width: 480, height: 693 }],
    ])('holds the artwork aspect on %s', (_label, box) => {
      const { plateWidth, plateHeight } = gridMetrics(box);

      expect(plateWidth / plateHeight).toBeCloseTo(LOGO_ASPECT, 5);
    });

    // It still has to FIT: aspect is worthless if the plate spills out of the
    // tile that holds it, or pushes the sponsor's name off the bottom.
    it('stays inside the tile that holds it', () => {
      const { tileWidth, tileHeight, plateWidth, plateHeight } = gridMetrics(MOTO);

      expect(plateWidth).toBeLessThanOrEqual(tileWidth);
      expect(plateHeight).toBeLessThan(tileHeight);
    });

    it('is shorter than the tile is wide once the rows are stretched', () => {
      const { tileWidth, plateHeight } = gridMetrics(MOTO);

      expect(plateHeight).toBeLessThan(tileWidth);
      expect(plateHeight).toBeGreaterThan(0);
    });

    it('stops shrinking at a legible floor', () => {
      expect(gridMetrics({ width: 432, height: 120 }).plateHeight).toBe(MIN_PLATE_HEIGHT);
    });

    it('grows with the width of the screen', () => {
      const small = gridMetrics({ width: 320, height: 693 });
      const large = gridMetrics({ width: 480, height: 693 });

      expect(large.tileWidth).toBeGreaterThan(small.tileWidth);
    });
  });

  describe('before anything is measured', () => {
    // The frame between mount and the first onLayout. Zeroes, so the caller can
    // draw nothing rather than a size that visibly snaps into place.
    it.each([
      ['unmeasured', { width: 0, height: 0 }],
      ['negative', { width: -100, height: -100 }],
      ['NaN', { width: Number.NaN, height: Number.NaN }],
    ])('reports nothing to draw for a %s box', (_label, box) => {
      const { tileWidth, tileHeight, plateWidth, plateHeight } = gridMetrics(box);

      expect(tileWidth).toBe(0);
      expect(tileHeight).toBe(0);
      expect(plateWidth).toBe(0);
      expect(plateHeight).toBe(0);
    });

    // The width is known from the window before the height is, so a seeded
    // first frame still gets the columns right and falls back on the rows.
    it('uses the designed row count when only the width is known', () => {
      const metrics = gridMetrics({ width: 432, height: Number.POSITIVE_INFINITY });

      expect(metrics.rows).toBe(GRID_FALLBACK_ROWS);
      expect(metrics.tileWidth).toBeCloseTo(128, 0);
      expect(metrics.plateHeight).toBeGreaterThan(0);
    });
  });
});
