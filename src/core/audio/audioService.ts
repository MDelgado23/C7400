import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
  type AudioMetadata,
} from 'expo-audio';
import {
  usePlayerStore,
  toggleIntent,
  type NowPlaying,
} from '../store/playerStore';
import { mapStatusToEvent } from './statusMapping';
import { reconnectDecision } from './reconnectPolicy';

/**
 * audioService — the impure bridge between expo-audio and the player store.
 *
 * All native side effects live here. The pure decision logic is delegated:
 * status→event mapping to `statusMapping`, and toggle direction to the store's
 * `toggleIntent`. This module is intentionally thin and is exercised by E2E
 * tests (Phase 5), not unit tests.
 */

let player: AudioPlayer | null = null;
let currentStreamUrl: string | null = null;
let reconnectAttempt = 0;

/** Publishes now-playing metadata to the OS lock screen (live = no scrub bar). */
function pushLockScreen(np: NowPlaying): void {
  if (!player) return;
  const metadata: AudioMetadata = {
    title: np.title,
    artist: 'LU32',
    artworkUrl: np.imageUrl,
  };
  player.setActiveForLockScreen(true, metadata, { isLiveStream: true });
}

/**
 * Initialize the engine for a live stream. `doNotMix` is REQUIRED for
 * lock-screen controls and for sustained (>3 min) Android background playback.
 */
export async function initAudio(streamUrl: string): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  });

  currentStreamUrl = streamUrl;
  player = createAudioPlayer(streamUrl);
  player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
    const event = mapStatusToEvent(status);
    if (!event) return;
    usePlayerStore.getState().applyEvent(event);
    if (event === 'PLAYING') {
      reconnectAttempt = 0; // healthy stream — reset backoff
    } else if (event === 'ERROR') {
      scheduleReconnect();
    }
  });
}

export function play(): void {
  player?.play();
  usePlayerStore.getState().applyEvent('PLAY');
}

export function pause(): void {
  player?.pause();
  usePlayerStore.getState().applyEvent('PAUSE');
}

/** Toggle: pure decision from store state, impure effect on the engine. */
export function toggle(): void {
  if (toggleIntent(usePlayerStore.getState().state) === 'play') play();
  else pause();
}

/** Low-level reconnect: reload the live source and play. Does NOT reset backoff. */
function reconnect(): void {
  usePlayerStore.getState().applyEvent('RETRY');
  if (player && currentStreamUrl) {
    player.replace(currentStreamUrl);
    player.play();
  }
}

/** Schedule an auto-reconnect with exponential backoff, or give up. */
function scheduleReconnect(): void {
  const { shouldRetry, delayMs } = reconnectDecision(reconnectAttempt);
  if (!shouldRetry) return; // exhausted → stays in error; user retries manually
  reconnectAttempt += 1;
  setTimeout(reconnect, delayMs);
}

/** Manual retry from the error UI: reset backoff and reconnect immediately. */
export function retry(): void {
  reconnectAttempt = 0;
  reconnect();
}

/** Update now-playing across the store and the lock screen. */
export function setNowPlaying(np: NowPlaying): void {
  usePlayerStore.getState().setProgram(np);
  pushLockScreen(np);
}

/** Free native resources and clear lock-screen controls. */
export function teardownAudio(): void {
  player?.clearLockScreenControls();
  player?.remove();
  player = null;
}
