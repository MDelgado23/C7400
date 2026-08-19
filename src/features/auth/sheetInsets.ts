/**
 * Bottom spacing for the auth sheet — PURE.
 *
 * Two separate things want to cover the bottom of this sheet, and neither is
 * handled for us:
 *
 * 1. THE NAVIGATION BAR. The app draws edge-to-edge (`navigationBarColor` is
 *    transparent in styles.xml), so the sheet's last row lands underneath
 *    Android's three buttons unless we inset it ourselves.
 *
 * 2. THE KEYBOARD. The sheet lives inside a React Native `Modal`, which on
 *    Android is its own Dialog window and does NOT inherit the activity's
 *    `android:windowSoftInputMode="adjustResize"`. Nothing moves on its own.
 *
 * They are never additive: the keyboard is drawn OVER the navigation bar, so
 * padding for both at once leaves a dead gap between the sheet and the keys.
 */

/** Breathing room when nothing else claims the bottom edge (gesture navigation). */
export const SHEET_MIN_BOTTOM = 24;

interface InsetInput {
  /** Height of the on-screen keyboard, or 0 when it is closed. */
  keyboardHeight: number;
  /** Bottom safe-area inset — the navigation bar on this device. */
  safeAreaBottom: number;
}

/** PURE. How much space to leave below the sheet's content. */
export function sheetBottomInset({ keyboardHeight, safeAreaBottom }: InsetInput): number {
  // Guarded rather than trusted: keyboard events have been observed reporting a
  // negative height mid-rotation, and a negative padding collapses the layout
  // silently instead of failing.
  if (keyboardHeight > 0) return keyboardHeight;
  return Math.max(safeAreaBottom, SHEET_MIN_BOTTOM);
}
