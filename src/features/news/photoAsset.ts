/**
 * Choosing which rendition of a photo to show — PURE.
 *
 * The CDN does not send one image, it sends a MENU. For a single photo it
 * publishes renditions tagged by height (`180`, `360`, `540`, `720`) in up to
 * three formats each, plus `t360` — a 360x360 SQUARE CROP, framed differently
 * from the rest. Picking well is the difference between a sharp photo and a
 * mangled one, and between a 72pt thumbnail costing 4 KB or 43 KB.
 *
 * TWO THINGS HERE WERE WRONG FOR A LONG TIME, and both are worth naming.
 *
 * 1. THE MEASUREMENTS LIVE UNDER `metadata`. The old code read `file.width`,
 *    which is always undefined, so every comparison was `0 > 0` — false. The
 *    hero ended up as whatever came first (the square thumbnail) and the card
 *    thumb as whatever came last (a 540x720 HEIF). The unit tests passed the
 *    whole time, because the FIXTURE had the wrong shape too: it put `width` at
 *    the top level, so it tested a payload the API has never sent.
 *
 * 2. `t360` IS NOT A SMALL VERSION, IT IS A DIFFERENT CROP. Used as a hero it
 *    stretches a square across a wide frame, which is exactly why some photos
 *    looked mangled. Used as the card's square thumb it is perfect — that is
 *    what the CDN made it for.
 */

export interface TadevelPhotoFile {
  url: string;
  tag?: string;
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
  };
}

export interface TadevelPhotoAsset {
  id: string;
  files: TadevelPhotoFile[];
}

export interface HeroImage {
  url: string;
  /** Width over height. What the frame should be shaped like. */
  aspectRatio: number;
}

/** The tag of the square crop. Right for a square box, wrong for anything else. */
const SQUARE_TAG = 't360';

/**
 * The shape most of the newsroom's photos have — measured over a hundred of
 * them, where the median is 1.51 and 57% sit between 1.5 and 1.9. Used only
 * when a file carries no measurements at all, which is rare; a guess has to be
 * wrong for somebody, so it is wrong for the fewest.
 */
export const DEFAULT_ASPECT_RATIO = 1.5;

/**
 * Formats both platforms certainly decode, best first.
 *
 * HEIF is deliberately absent. The CDN publishes the 540 rendition in HEIF
 * ONLY, and while modern Android and iOS can usually read it, "usually" is not
 * good enough for a photo: one that silently fails to draw leaves a hole in the
 * article, and a slightly smaller rendition that certainly draws is the better
 * trade. It is still used as a last resort — see `pickHero`.
 */
const SAFE_FORMATS = ['webp', 'jpeg', 'jpg', 'png'];

function rank(file: TadevelPhotoFile): number {
  const index = SAFE_FORMATS.indexOf((file.metadata?.format ?? '').toLowerCase());
  return index === -1 ? SAFE_FORMATS.length : index;
}

function pixels(file: TadevelPhotoFile): number {
  return (file.metadata?.width ?? 0) * (file.metadata?.height ?? 0);
}

/**
 * PURE. The rendition to use as the article's hero, with the shape to draw it in.
 *
 * Biggest wins, but only among formats that certainly render: a photo that does
 * not draw is worse than one drawn slightly smaller. The square crop is never a
 * candidate, whatever size it comes in.
 */
export function pickHero(asset: TadevelPhotoAsset | null | undefined): HeroImage | undefined {
  const candidates = (asset?.files ?? []).filter((file) => file.tag !== SQUARE_TAG);
  if (candidates.length === 0) return undefined;

  const best = candidates.reduce((a, b) => {
    // Format first, size second. Reversing these is how a HEIF-only rendition
    // wins for being larger and then fails to appear.
    if (rank(a) !== rank(b)) return rank(a) < rank(b) ? a : b;
    return pixels(b) > pixels(a) ? b : a;
  });

  const width = best.metadata?.width;
  const height = best.metadata?.height;
  return {
    url: best.url,
    aspectRatio:
      width !== undefined && height !== undefined && height > 0
        ? width / height
        : DEFAULT_ASPECT_RATIO,
  };
}

/**
 * PURE. The rendition for the feed card's square thumb.
 *
 * The card's box is square and the CDN already cut a square crop for it, so
 * this is a lookup rather than a calculation. Only when that crop is missing
 * does size come into it, and then the SMALLEST wins: the box is 72pt, and
 * anything bigger is mobile data spent on pixels nobody sees.
 */
export function pickSquareThumb(asset: TadevelPhotoAsset | null | undefined): string | undefined {
  const files = asset?.files ?? [];
  if (files.length === 0) return undefined;

  const square = files.find((file) => file.tag === SQUARE_TAG);
  if (square !== undefined) return square.url;

  const smallest = files.reduce((a, b) => (pixels(b) > 0 && pixels(b) < pixels(a) ? b : a));
  return smallest.url;
}
