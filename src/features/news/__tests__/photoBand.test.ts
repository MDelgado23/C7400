import { HERO_BAND_RATIO, PHOTO_FOCUS, bandCrop } from '../photoBand';
import { DEFAULT_ASPECT_RATIO } from '../photoAsset';

/**
 * What the band actually leaves out, top and bottom, as fractions of the
 * photo's own height. Derived from the style values rather than asserted
 * against them, so the tests below read as the rule and not as arithmetic.
 */
function hidden(photoRatio: number | undefined) {
  const crop = bandCrop(photoRatio);
  // The shift is a percentage of the band's WIDTH, which is how percentage
  // margins resolve; over the photo's own height it becomes a fraction of it.
  const above = (-crop.shiftPercent / 100) * crop.photoAspectRatio;
  const visible = crop.photoAspectRatio / HERO_BAND_RATIO;
  return { above, visible, below: 1 - visible - above };
}

describe('bandCrop', () => {
  // THE RULE, in the shape it was asked for: with half the photo visible, the
  // top fifth is left out and the bottom three tenths are.
  it('leaves out the top 20% and the bottom 30% when half the photo fits', () => {
    const half = HERO_BAND_RATIO * 0.5;

    const { above, visible, below } = hidden(half);

    expect(visible).toBeCloseTo(0.5, 3);
    expect(above).toBeCloseTo(0.2, 3);
    expect(below).toBeCloseTo(0.3, 3);
  });

  // The generalisation of it: the visible window is centred a little above the
  // middle of the photo. On a news photo the subject sits there — pinned to the
  // very top the band fills up with ceiling and sky, and centred it cuts faces.
  it.each([0.5, 0.6, 0.75, 0.9])('centres the window at the focus for a %s photo', (ratio) => {
    const { above, visible } = hidden(ratio);

    expect(above + visible / 2).toBeCloseTo(PHOTO_FOCUS, 3);
  });

  it('looks slightly above the middle', () => {
    expect(PHOTO_FOCUS).toBeLessThan(0.5);
    expect(PHOTO_FOCUS).toBeGreaterThan(0.35);
  });

  describe('when there is little or nothing to hide', () => {
    // Only a tenth is being cut, so the window cannot start a fifth of the way
    // down — it would have to hide more than exists. It slides up to the top and
    // everything cut comes off the bottom.
    it('never asks to hide more above than the photo has to spare', () => {
      const { above, below } = hidden(HERO_BAND_RATIO * 0.9);

      expect(above).toBeCloseTo(0, 3);
      expect(below).toBeCloseTo(0.1, 3);
    });

    it('does not move a photo the same shape as the band', () => {
      const crop = bandCrop(HERO_BAND_RATIO);

      expect(crop.shiftPercent).toBe(0);
      expect(crop.photoAspectRatio).toBeCloseTo(HERO_BAND_RATIO, 3);
    });

    // A wide photo is cropped left and right, not top and bottom, so there is
    // no window to slide: it takes the band's shape and `cover` centres it.
    it.each([2, 3.2])('does not move a %s photo, which is wider than the band', (ratio) => {
      const crop = bandCrop(ratio);

      expect(crop.shiftPercent).toBe(0);
      expect(crop.photoAspectRatio).toBeCloseTo(HERO_BAND_RATIO, 3);
    });
  });

  describe('nothing to work from', () => {
    it('falls back to the shape most of the newsroom photos have', () => {
      expect(bandCrop(undefined).photoAspectRatio).toBeCloseTo(DEFAULT_ASPECT_RATIO, 3);
    });

    it.each([
      ['zero', 0],
      ['negative', -1],
      ['NaN', Number.NaN],
    ])('falls back for a %s ratio rather than dividing by it', (_label, ratio) => {
      const crop = bandCrop(ratio);

      expect(crop.photoAspectRatio).toBeCloseTo(DEFAULT_ASPECT_RATIO, 3);
      expect(Number.isFinite(crop.shiftPercent)).toBe(true);
    });
  });

  // Whatever the shape, the photo must always cover the band: a gap at the
  // bottom would show the placeholder colour through it.
  it.each([0.4, 0.75, 1.5, 1.78, 3.2])('always fills the band for a %s photo', (ratio) => {
    const { above, visible } = hidden(ratio);

    expect(above).toBeGreaterThanOrEqual(-0.0001);
    expect(above + visible).toBeLessThanOrEqual(1.0001);
  });
});
