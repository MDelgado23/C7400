import type { PlayerEvent } from '../store/playerStore';

/**
 * Narrow view of expo-audio's `AudioStatus` — only the fields the mapping
 * reads. Keeping this a structural subset lets the module stay free of any
 * native (`expo-audio`) import, so it remains pure and unit-testable while the
 * real `AudioStatus` is still assignable to it.
 */
export interface PlaybackStatusLike {
  playing: boolean;
  isBuffering: boolean;
  /** 'playing' | 'paused' | 'waiting' — expo-audio has no boolean `paused`. */
  timeControlStatus: string;
  /** True when a live stream ended/dropped. */
  didJustFinish: boolean;
  error: string | null;
}

/**
 * PURE: translate an engine status into a player-store event.
 * Returns null when the status carries no meaningful state change.
 * Precedence: error/drop > paused > (re)buffering > playing.
 * A dropped live stream (`didJustFinish`) is surfaced as ERROR so the
 * reconnect policy can decide whether to auto-retry.
 *
 * An explicit pause outranks buffering: the engine keeps reporting
 * `isBuffering` after a pause taken mid-rebuffer, and reading that as BUFFERING
 * flips the store out of `paused` — which makes the next toggle pause again,
 * trapping the user with a spinner they cannot dismiss.
 */
export function mapStatusToEvent(status: PlaybackStatusLike): PlayerEvent | null {
  if (status.error || status.didJustFinish) return 'ERROR';
  if (status.timeControlStatus === 'paused') return 'PAUSE';
  if (status.isBuffering && !status.playing) return 'BUFFERING';
  if (status.playing) return 'PLAYING';
  return null;
}
