import { create } from 'zustand';

/** Playback lifecycle states for the live radio player. */
export type PlayerState = 'idle' | 'buffering' | 'playing' | 'paused' | 'error';

/** Events that drive the player state machine. */
export type PlayerEvent = 'PLAY' | 'BUFFERING' | 'PLAYING' | 'PAUSE' | 'ERROR' | 'RETRY';

/** Current program / track metadata shown in the player and mini-player. */
export interface NowPlaying {
  title: string;
  imageUrl?: string;
}

/** States in which audio is active (playing or on its way to playing). */
const ACTIVE_STATES: readonly PlayerState[] = ['playing', 'buffering'];

/**
 * Pure state-machine transition. Deterministic: same (state, event) → same
 * next state. No side effects — the audio engine and store wire into this.
 * Unknown/nonsensical transitions leave the state unchanged.
 */
export function playerReducer(state: PlayerState, event: PlayerEvent): PlayerState {
  switch (event) {
    case 'ERROR':
      return 'error';
    case 'PLAY':
      // Including `error`: PLAY is an explicit user intent, and the mini-player
      // offers a ▶ in the error state (toggleIntent('error') === 'play'), so
      // swallowing it here would leave that button permanently dead. The audio
      // service reloads the source before it emits PLAY from `error`.
      return 'buffering';
    case 'RETRY':
      return 'buffering';
    case 'BUFFERING':
      return 'buffering';
    case 'PLAYING':
      return 'playing';
    case 'PAUSE':
      return ACTIVE_STATES.includes(state) ? 'paused' : state;
    default:
      return state;
  }
}

/** Pure: given the current state, should a toggle start or stop audio? */
export function toggleIntent(state: PlayerState): 'play' | 'pause' {
  return ACTIVE_STATES.includes(state) ? 'pause' : 'play';
}

interface PlayerStore {
  state: PlayerState;
  program?: NowPlaying;
  /** Feed a state-machine event (usually from the audio engine). */
  applyEvent: (event: PlayerEvent) => void;
  /** Update the now-playing metadata (undefined clears it → logo fallback). */
  setProgram: (program?: NowPlaying) => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  state: 'idle',
  program: undefined,
  applyEvent: (event) => set((s) => ({ state: playerReducer(s.state, event) })),
  setProgram: (program) => set({ program }),
}));
