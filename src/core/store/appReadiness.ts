import type { PlayerState } from './playerStore';

/**
 * PURE: should the loading splash hand off to the app yet?
 *
 * Reveal once the intro animation has played AND playback is truly underway
 * ('playing') — so the splash covers the initial buffering and the user never
 * sees a "loading" flash. Also reveal on 'error' so a failed/offline stream drops
 * the user straight onto the retry UI instead of stranding them on the splash.
 * ('buffering' and 'idle' keep the splash up.)
 */
export function shouldRevealApp(
  animationDone: boolean,
  state: PlayerState,
): boolean {
  return animationDone && (state === 'playing' || state === 'error');
}
