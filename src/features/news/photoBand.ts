import { DEFAULT_ASPECT_RATIO } from './photoAsset';

/**
 * How the article's photo sits inside its band — PURE.
 *
 * The band is a fixed shape and most photos are taller than it, so most of them
 * are cropped top and bottom. WHERE that window falls is the whole question,
 * and neither of the obvious answers is right:
 *
 *   - CENTRED, which is what an image does by default, cuts faces off a
 *     portrait and keeps the torso.
 *   - PINNED TO THE TOP keeps the faces, but fills the band with whatever is
 *     above them — ceiling, sky, the top of a doorway — and throws away the
 *     bottom of the picture to make room for it.
 *
 * So the window is centred a little ABOVE the middle of the photo, which is
 * where the subject of a news photograph actually sits. Half a photo visible
 * leaves out the top fifth and the bottom three tenths.
 */

/**
 * The shape of the photo band at the top of every article.
 *
 * 16:9 measured out best over a hundred of the newsroom's photos. Wider bands
 * crop hard (2:1 loses 28% of the average photo); taller ones barely crop less
 * — 3:2 saves two points — while eating 36% of the screen instead of 30%, which
 * is what pushes the deck and the save button below the fold. At 16:9 the
 * median photo still shows 85% of itself and a third of them show essentially
 * all of it.
 */
export const HERO_BAND_RATIO = 16 / 9;

/**
 * Where the interesting part of a news photograph sits, as a fraction of its
 * height from the top. The visible window is centred here.
 *
 * Slightly above the middle, and that is the entire adjustment: at 0.5 the band
 * is centred and cuts faces; at 0 it is pinned to the top and fills with empty
 * ceiling. 0.45 is what makes "half the photo visible" leave out the top 20%
 * and the bottom 30%.
 */
export const PHOTO_FOCUS = 0.45;

export interface BandCrop {
  /** The shape to draw the photo at inside the band. */
  photoAspectRatio: number;
  /**
   * How far to slide the photo up, as a percentage of the BAND'S WIDTH.
   *
   * Width, not height, because that is how a percentage margin resolves — in
   * Yoga as in CSS, vertical percentages are measured against the containing
   * block's width. Zero or negative; never positive, which would leave a gap.
   */
  shiftPercent: number;
}

/**
 * PURE. How to place a photo of a given shape inside the band.
 *
 * A photo WIDER than the band is not cropped vertically at all — it takes the
 * band's shape and `cover` trims the sides, where centred is exactly right — so
 * there is no window to slide and the shift is zero.
 */
export function bandCrop(
  photoRatio: number | undefined,
  bandRatio: number = HERO_BAND_RATIO,
): BandCrop {
  // A missing, zero or negative ratio would divide the layout by nothing. The
  // fallback is the shape most of these photos actually have.
  const ratio =
    photoRatio !== undefined && Number.isFinite(photoRatio) && photoRatio > 0
      ? photoRatio
      : DEFAULT_ASPECT_RATIO;

  // Taller than the band: drawn at its own shape and clipped. Wider: drawn at
  // the band's shape and trimmed at the sides.
  const photoAspectRatio = Math.min(ratio, bandRatio);
  if (photoAspectRatio >= bandRatio) return { photoAspectRatio, shiftPercent: 0 };

  /** How much of the photo's height the band shows. */
  const visible = photoAspectRatio / bandRatio;
  /**
   * Where the window starts, clamped so it always stays inside the photo.
   *
   * The clamp is not a formality: when only a tenth is being cut there is no
   * fifth to hide above it, and without this the photo would slide far enough
   * to leave a gap at the bottom of the band.
   */
  const hiddenAbove = Math.min(Math.max(PHOTO_FOCUS - visible / 2, 0), 1 - visible);

  // The photo is `1 / photoAspectRatio` times the band's width tall, so hiding
  // `hiddenAbove` of it means sliding up that share of that height.
  return {
    photoAspectRatio,
    shiftPercent: -(hiddenAbove / photoAspectRatio) * 100,
  };
}
