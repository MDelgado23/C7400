import { sheetBottomInset, SHEET_MIN_BOTTOM } from '../sheetInsets';

describe('sheetBottomInset', () => {
  it('lifts the sheet by the keyboard height while it is open', () => {
    // The sheet lives in a Modal, which on Android is its own Dialog window and
    // does NOT inherit the activity's adjustResize. Nothing moves on its own, so
    // the lift has to be applied by hand.
    expect(sheetBottomInset({ keyboardHeight: 320, safeAreaBottom: 48 })).toBe(320);
  });

  it('ignores the navigation bar while the keyboard is open', () => {
    // The keyboard is drawn OVER the navigation bar. Adding both would leave a
    // 48pt gap of nothing between the sheet and the keys.
    expect(sheetBottomInset({ keyboardHeight: 320, safeAreaBottom: 48 })).toBe(320);
    expect(sheetBottomInset({ keyboardHeight: 320, safeAreaBottom: 0 })).toBe(320);
  });

  it('clears the navigation bar when the keyboard is closed', () => {
    // The app draws edge-to-edge (navigationBarColor is transparent), so without
    // this the bottom of the sheet sits underneath Android's three buttons.
    expect(sheetBottomInset({ keyboardHeight: 0, safeAreaBottom: 48 })).toBe(48);
  });

  it('keeps a breathing minimum on a device with no bottom inset', () => {
    // Gesture navigation reports 0. The sheet still should not end flush against
    // the screen edge.
    expect(sheetBottomInset({ keyboardHeight: 0, safeAreaBottom: 0 })).toBe(SHEET_MIN_BOTTOM);
  });

  it('never goes below the minimum for a thin inset', () => {
    expect(sheetBottomInset({ keyboardHeight: 0, safeAreaBottom: 8 })).toBe(SHEET_MIN_BOTTOM);
  });

  it('treats a nonsense measurement as no keyboard', () => {
    // Keyboard events have been seen reporting negative heights mid-rotation.
    // A negative padding silently collapses the layout.
    expect(sheetBottomInset({ keyboardHeight: -12, safeAreaBottom: 48 })).toBe(48);
  });
});
