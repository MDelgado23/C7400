import type { PlayerState } from './playerStore';

/**
 * PURE: should the loading splash hand off to the app yet?
 *
 * Reveal once the intro animation has played AND playback is truly underway
 * ('playing') — so the splash covers the initial buffering and the user never
 * sees a "loading" flash. Also reveal on 'error' so a failed/offline stream drops
 * the user straight onto the retry UI instead of stranding them on the splash.
 * ('buffering' and 'idle' keep the splash up.)
 *
 * AND until the saved theme has been read off the device. Same reasoning as the
 * buffering: the splash exists to cover the moments where the app does not yet
 * know what it is about to show. Revealing first would paint the default theme
 * and then repaint it in front of the user. The disk read takes milliseconds and
 * finishes long before the stream connects, so in practice this condition is
 * already satisfied by the time the others are — it is here for the cold boot
 * where it is not, and `App`'s hard cap still applies if it never settles.
 */
export function shouldRevealApp(
  animationDone: boolean,
  state: PlayerState,
  themeHydrated: boolean,
): boolean {
  return animationDone && themeHydrated && (state === 'playing' || state === 'error');
}
