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
 * Precedence: error/drop > (re)buffering > playing > paused.
 * A dropped live stream (`didJustFinish`) is surfaced as ERROR so the
 * reconnect policy can decide whether to auto-retry.
 */
export function mapStatusToEvent(status: PlaybackStatusLike): PlayerEvent | null {
  if (status.error || status.didJustFinish) return 'ERROR';
  if (status.isBuffering && !status.playing) return 'BUFFERING';
  if (status.playing) return 'PLAYING';
  if (status.timeControlStatus === 'paused') return 'PAUSE';
  return null;
}
