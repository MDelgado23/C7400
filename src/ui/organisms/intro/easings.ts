/**
 * easings — pure timing functions used by the Conexion7400 intro.
 *
 * Ported 1:1 from the Claude Design reference (animations-v2 `Easing`). Kept
 * dependency-free so the intro's scene math stays unit-testable without React
 * Native or Reanimated in scope.
 *
 * Each carries the `'worklet'` directive so the intro can run the whole timeline
 * on Reanimated's UI thread (a worklet may only call other worklets). The
 * directive is an inert string literal under plain Jest/Node — these functions
 * remain ordinary, synchronously-callable JS until the worklets Babel plugin
 * transforms them, so the unit tests exercise the exact same code.
 */

/** Clamp `v` into the inclusive `[lo, hi]` range. */
export function clamp(v: number, lo: number, hi: number): number {
  'worklet';
  return Math.min(Math.max(v, lo), hi);
}

// Overshoot constants for the "back" family (the CSS/standard values).
const BACK_C1 = 1.70158;
const BACK_C3 = BACK_C1 + 1;

/** Overshoots past 1 then settles back — the "pop" of the mark. */
export function easeOutBack(x: number): number {
  'worklet';
  return 1 + BACK_C3 * Math.pow(x - 1, 3) + BACK_C1 * Math.pow(x - 1, 2);
}

/** Symmetric quadratic ease; 0→0, 0.5→0.5, 1→1. */
export function easeInOutQuad(x: number): number {
  'worklet';
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/** Symmetric cubic ease; steeper middle than quad. */
export function easeInOutCubic(x: number): number {
  'worklet';
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Decelerating quadratic; fast start, gentle finish. */
export function easeOutQuad(x: number): number {
  'worklet';
  return 1 - (1 - x) * (1 - x);
}
