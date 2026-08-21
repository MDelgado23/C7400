import { DEFAULT_ASPECT_RATIO, pickHero, pickSquareThumb } from '../photoAsset';
import type { TadevelPhotoAsset } from '../photoAsset';

/**
 * The shape the CDN ACTUALLY serves, copied from a live response.
 *
 * The old fixture put `width` at the top level of each file. The API puts it
 * under `metadata`, so every comparison in the picker read `undefined` and the
 * tests passed over code that never worked — the hero got the 360px square
 * thumbnail and the 72pt card thumb downloaded a 540x720 HEIF. A fixture that
 * does not match the wire is worse than no fixture at all.
 */
function file(tag: string, width: number, height: number, format: string) {
  return {
    url: `https://cdn/${tag}.${format}`,
    tag,
    metadata: { width, height, format },
  };
}

/** A portrait photo, with every rendition the CDN makes. */
const ASSET: TadevelPhotoAsset = {
  id: 'asset1',
  files: [
    file('t360', 360, 360, 'jpeg'),
    file('180', 135, 180, 'webp'),
    file('180', 135, 180, 'heif'),
    file('360', 270, 360, 'webp'),
    file('540', 405, 540, 'heif'),
    file('720', 540, 720, 'jpeg'),
    file('720', 540, 720, 'webp'),
  ],
};

describe('pickHero', () => {
  it('takes the biggest rendition, so a full-width photo is not upscaled', () => {
    expect(pickHero(ASSET)?.url).toBe('https://cdn/720.webp');
  });

  // `t360` is a SQUARE CROP, not a small version of the photo. Using it as the
  // hero is what made portrait photos look mangled: a 1:1 crop stretched across
  // a wide frame.
  it('never uses the square crop, however big it is', () => {
    const squareIsBiggest: TadevelPhotoAsset = {
      id: 'a',
      files: [file('t360', 1200, 1200, 'jpeg'), file('360', 270, 360, 'webp')],
    };

    expect(pickHero(squareIsBiggest)?.url).toBe('https://cdn/360.webp');
  });

  // The 540 rendition is HEIF-ONLY. Neither platform is guaranteed to decode
  // it, and a photo that silently does not draw is worse than a smaller one
  // that does.
  it('prefers a format that certainly draws over a bigger one that might not', () => {
    const heifIsBiggest: TadevelPhotoAsset = {
      id: 'a',
      files: [file('360', 270, 360, 'webp'), file('540', 405, 540, 'heif')],
    };

    expect(pickHero(heifIsBiggest)?.url).toBe('https://cdn/360.webp');
  });

  it('falls back to an odd format rather than showing nothing', () => {
    const onlyHeif: TadevelPhotoAsset = { id: 'a', files: [file('540', 405, 540, 'heif')] };

    expect(pickHero(onlyHeif)?.url).toBe('https://cdn/540.heif');
  });

  describe('the aspect ratio comes with it', () => {
    it('reports the photo shape, so the frame can match it', () => {
      expect(pickHero(ASSET)?.aspectRatio).toBeCloseTo(540 / 720, 3);
    });

    it.each([
      ['a wide photo', 1920, 1080, 1920 / 1080],
      ['a panorama', 1600, 500, 1600 / 500],
      ['a tall photo', 600, 1200, 0.5],
    ])('reports %s as %s by %s', (_label, w, h, expected) => {
      const asset: TadevelPhotoAsset = { id: 'a', files: [file('720', w, h, 'jpeg')] };

      expect(pickHero(asset)?.aspectRatio).toBeCloseTo(expected, 3);
    });

    // Without measurements there is nothing to derive a shape from, and a
    // guess would be wrong for most photos. The frame falls back to the shape
    // most of them have.
    it('falls back to a common shape when the file carries no measurements', () => {
      const noMeta: TadevelPhotoAsset = { id: 'a', files: [{ url: 'https://cdn/x.jpg' }] };

      expect(pickHero(noMeta)?.aspectRatio).toBe(DEFAULT_ASPECT_RATIO);
    });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['no files', { id: 'x', files: [] }],
  ])('returns nothing for %s', (_label, asset) => {
    expect(pickHero(asset as TadevelPhotoAsset | null)).toBeUndefined();
  });
});

describe('pickSquareThumb', () => {
  // The card's thumb box IS square, and the CDN already made a square crop for
  // exactly this. Picking by size instead meant downloading a 540x720 photo to
  // render a 72pt stamp.
  it('uses the square crop the CDN made for it', () => {
    expect(pickSquareThumb(ASSET)).toBe('https://cdn/t360.jpeg');
  });

  it('falls back to the smallest rendition when there is no square crop', () => {
    const noSquare: TadevelPhotoAsset = {
      id: 'a',
      files: [file('720', 540, 720, 'jpeg'), file('360', 270, 360, 'webp')],
    };

    expect(pickSquareThumb(noSquare)).toBe('https://cdn/360.webp');
  });

  it.each([
    ['null', null],
    ['no files', { id: 'x', files: [] }],
  ])('returns nothing for %s', (_label, asset) => {
    expect(pickSquareThumb(asset as TadevelPhotoAsset | null)).toBeUndefined();
  });
});
