import {
  createAudioPlayer,
  setAudioModeAsync,
  requestNotificationPermissionsAsync,
  type AudioPlayer,
  type AudioStatus,
  type AudioMetadata,
} from 'expo-audio';
import {
  usePlayerStore,
  toggleIntent,
  type NowPlaying,
} from '../store/playerStore';
import {
  addNetworkStateListener,
  getNetworkStateAsync,
  type NetworkState,
} from 'expo-network';
import { Asset } from 'expo-asset';
import { mapStatusToEvent } from './statusMapping';
import { reconnectStrategy, type NetworkStateLike } from './reconnectPolicy';
import { validArtworkUrl } from './artworkUrl';

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

/**
 * Live network state, kept fresh by the listener below, so a stream drop can be
 * classified (offline vs. server error) synchronously. `null` reachability = the
 * OS hasn't decided; the strategy treats that as "maybe online".
 */
let lastNetworkState: NetworkStateLike = {
  isConnected: true,
  isInternetReachable: null,
};
/** Set when a drop happened offline: reconnect the instant the network returns. */
let awaitingNetwork = false;
let netSubscription: ReturnType<typeof addNetworkStateListener> | null = null;

/**
 * Fallback now-playing used to activate lock-screen controls the moment audio
 * starts, before any real program metadata arrives. Activating the lock screen
 * is what starts the Android media foreground service that keeps background
 * playback alive — without it the OS kills the stream shortly after backgrounding.
 */
const DEFAULT_NOW_PLAYING: NowPlaying = { title: 'En vivo' };

/**
 * The bundled LU32 station badge, resolved to a local URI so it can be used as
 * the lock-screen / notification artwork when a live program has no image of its
 * own. Resolved once (async) at init; falls back to `undefined` on failure.
 */
const LU32_LOGO = require('../../../assets/logo-am.png');
let lu32LogoUri: string | undefined;

async function resolveLogoUri(): Promise<void> {
  try {
    const asset = Asset.fromModule(LU32_LOGO);
    await asset.downloadAsync();
    // Only keep it if it's a real URL (file://). In release builds a bundled
    // asset can resolve to a scheme-less id ("assets_logoam") that expo-audio
    // rejects with MalformedURLException — validArtworkUrl drops those.
    lu32LogoUri = validArtworkUrl(asset.localUri ?? asset.uri ?? undefined);
  } catch {
    lu32LogoUri = undefined;
  }
}

/** Publishes now-playing metadata to the OS lock screen (live = no scrub bar). */
function pushLockScreen(np: NowPlaying): void {
  if (!player) return;
  const metadata: AudioMetadata = {
    title: np.title,
    artist: 'LU32',
    // Program image when we have one, otherwise the station badge so the media
    // notification / lock screen is never blank on the live stream. BOTH are
    // validated: a scheme-less artworkUrl crashes setActiveForLockScreen.
    artworkUrl: validArtworkUrl(np.imageUrl) ?? lu32LogoUri,
  };
  // Defensive: a bad metadata/artwork value must never crash playback. This runs
  // from UI events (toggle) where an uncaught throw is a hard app crash.
  try {
    player.setActiveForLockScreen(true, metadata, { isLiveStream: true });
  } catch {
    // Lock-screen controls are best-effort; audio keeps playing regardless.
  }
}

/**
 * Initialize the engine for a live stream. `doNotMix` is REQUIRED for
 * lock-screen controls and for sustained (>3 min) Android background playback.
 */
export async function initAudio(streamUrl: string): Promise<void> {
  // Android 13+: the media-playback foreground service can only post its
  // controls notification with POST_NOTIFICATIONS granted. Without it the OS
  // kills background audio after ~18s and no shade/lock-screen controls appear.
  // iOS is a no-op here (handled system-side).
  await requestNotificationPermissionsAsync();

  // Resolve the station badge to a local URI for the lock-screen artwork, in
  // parallel — pushLockScreen reads it once available, falling back to blank.
  void resolveLogoUri();

  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  });

  // Track connectivity so a drop can be told apart from a server-side failure.
  // Seed synchronously-ish, then keep it live: reconnect the moment WiFi returns
  // after a screen-off drop, instead of burning timed retries against no route.
  getNetworkStateAsync()
    .then((state) => {
      lastNetworkState = toNetworkStateLike(state);
    })
    .catch(() => {});
  netSubscription?.remove();
  netSubscription = addNetworkStateListener(onNetworkChange);

  currentStreamUrl = streamUrl;
  player = createAudioPlayer(streamUrl);
  player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
    const event = mapStatusToEvent(status);
    if (!event) return;
    usePlayerStore.getState().applyEvent(event);
    if (event === 'PLAYING') {
      reconnectAttempt = 0; // healthy stream — reset backoff
      awaitingNetwork = false;
    } else if (event === 'ERROR') {
      handleStreamDrop();
    }
  });
}

/** Narrow expo-network's `NetworkState` to what the reconnect policy reads. */
function toNetworkStateLike(state: NetworkState): NetworkStateLike {
  return {
    isConnected: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable ?? null,
  };
}

/**
 * React to connectivity changes. When we're parked waiting for the network and
 * it comes back, reconnect immediately with a fresh backoff budget — this is
 * what makes the stream resume the instant the screen turns back on.
 */
function onNetworkChange(state: NetworkState): void {
  lastNetworkState = toNetworkStateLike(state);
  const online =
    lastNetworkState.isConnected && lastNetworkState.isInternetReachable !== false;
  if (awaitingNetwork && online) {
    awaitingNetwork = false;
    reconnectAttempt = 0; // network restored → not a failed retry, start clean
    reconnect();
  }
}

export function play(): void {
  player?.play();
  usePlayerStore.getState().applyEvent('PLAY');
  // Activate lock-screen controls on every playback start. This is what spins up
  // the media foreground service; without it Android tears down background audio.
  pushLockScreen(usePlayerStore.getState().program ?? DEFAULT_NOW_PLAYING);
  // NOTE: the Doze/battery-optimization exemption is intentionally NOT prompted
  // here. Autoplay calls play() on launch, and an auto-firing system dialog would
  // collide with the persistent BackgroundPlaybackNotice. The notice is now the
  // single, user-initiated path to the exemption (see useBackgroundPlaybackWarning).
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

/**
 * Decide what to do after a stream drop based on attempts AND live network:
 * park until connectivity returns when offline, timed backoff when online, or
 * give up once online retries are exhausted (user retries manually from the UI).
 */
function handleStreamDrop(): void {
  const action = reconnectStrategy(reconnectAttempt, lastNetworkState);
  switch (action.kind) {
    case 'await-network':
      awaitingNetwork = true; // onNetworkChange fires reconnect when WiFi returns
      return;
    case 'backoff':
      reconnectAttempt += 1;
      setTimeout(reconnect, action.delayMs);
      return;
    case 'give-up':
      return; // stays in error; user retries manually
  }
}

/** Manual retry from the error UI: reset backoff and reconnect immediately. */
export function retry(): void {
  reconnectAttempt = 0;
  awaitingNetwork = false;
  reconnect();
}

/** Update now-playing across the store and the lock screen. */
export function setNowPlaying(np: NowPlaying): void {
  usePlayerStore.getState().setProgram(np);
  pushLockScreen(np);
}

/** Free native resources, stop listening for connectivity, clear controls. */
export function teardownAudio(): void {
  netSubscription?.remove();
  netSubscription = null;
  awaitingNetwork = false;
  player?.clearLockScreenControls();
  player?.remove();
  player = null;
}
