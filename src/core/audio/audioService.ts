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
import { mapStatusToEvent } from './statusMapping';
import { reconnectStrategy, type NetworkStateLike } from './reconnectPolicy';
import { validArtworkUrl } from './artworkUrl';
import { trackEvent } from '../observability/observability';
import { EVENTS } from '../observability/events';

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
/**
 * True once a real connectivity update has landed. The initial snapshot is
 * fetched without blocking init, so it can resolve *after* the listener has
 * already reported a change — a stale snapshot must never overwrite live state.
 */
let networkObserved = false;
/**
 * Bumped by every initAudio and every teardownAudio. Work started by one init
 * carries its generation and drops out if it no longer matches — an init can be
 * suspended on an await when the app unmounts (or re-boots), and resuming into
 * a superseded world resurrects a player and a subscription nobody owns.
 */
let initGeneration = 0;
/** Set when a drop happened offline: reconnect the instant the network returns. */
let awaitingNetwork = false;
let netSubscription: ReturnType<typeof addNetworkStateListener> | null = null;
/**
 * Handle of the armed backoff reconnect. Kept so it can be cancelled: a manual
 * retry, a play from the error state or a teardown all supersede it, and a
 * stale timer firing afterwards would reload the source and cut audio that is
 * already playing again.
 */
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * Latched once the reconnect budget is spent. The give-up branch arms no timer,
 * so nothing else throttles the report: the engine repeats the same error status
 * on every tick and each one would report another drop. Cleared whenever the
 * budget is reset.
 */
let gaveUp = false;

/**
 * Fallback now-playing used to activate lock-screen controls the moment audio
 * starts, before any real program metadata arrives. Activating the lock screen
 * is what starts the Android media foreground service that keeps background
 * playback alive — without it the OS kills the stream shortly after backgrounding.
 */
const DEFAULT_NOW_PLAYING: NowPlaying = { title: 'En vivo' };

/**
 * Station badge URL (from remote config) used as the lock-screen / media-
 * notification artwork when a live program has no image of its own. Must be a
 * real HTTP(S) URL — a bundled asset resolves to a scheme-less id in release,
 * which expo-audio rejects with MalformedURLException — so it's validated.
 */
let stationLogoUri: string | undefined;

/** Publishes now-playing metadata to the OS lock screen (live = no scrub bar). */
function pushLockScreen(np: NowPlaying): void {
  if (!player) return;
  const metadata: AudioMetadata = {
    title: np.title,
    artist: 'LU32',
    // Program image when we have one, otherwise the station badge so the media
    // notification / lock screen is never blank on the live stream. BOTH are
    // validated: a scheme-less artworkUrl crashes setActiveForLockScreen.
    artworkUrl: validArtworkUrl(np.imageUrl) ?? stationLogoUri,
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
export async function initAudio(streamUrl: string, logoUrl?: string): Promise<void> {
  // Station badge for the lock-screen / notification artwork. Validated here so
  // a bad value can never reach setActiveForLockScreen; undefined just means the
  // notification has no large artwork (Android still shows the app icon).
  const generation = ++initGeneration;
  networkObserved = false; // this init's snapshot is the fresh one again
  stationLogoUri = validArtworkUrl(logoUrl);

  // Android 13+: the media-playback foreground service can only post its
  // controls notification with POST_NOTIFICATIONS granted. Without it the OS
  // kills background audio after ~18s and no shade/lock-screen controls appear.
  // iOS is a no-op here (handled system-side).
  //
  // Deliberately NOT awaited: on a first Android 13+ launch this shows a system
  // dialog, and blocking here would stall the autoplay that is supposed to
  // buffer under the splash — the user would sit on the intro until they answer,
  // and MAX_SPLASH_MS would reveal the app still idle. The grant is picked up
  // below instead, once it lands.
  const permission = requestNotificationPermissionsAsync().catch(() => undefined);

  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  });
  if (generation !== initGeneration) return; // torn down (or re-inited) mid-flight

  // Track connectivity so a drop can be told apart from a server-side failure.
  // The listener is registered FIRST so it always wins: the snapshot below is
  // not awaited (it would delay playback), so it can land after a real change
  // has already been reported, and applying it then would rewind the state.
  netSubscription?.remove();
  netSubscription = addNetworkStateListener(onNetworkChange);
  getNetworkStateAsync()
    .then((state) => {
      if (generation !== initGeneration || networkObserved) return;
      lastNetworkState = toNetworkStateLike(state);
    })
    .catch(() => {});

  // Never overwrite a live player: two natives on the same stream play twice.
  player?.remove();
  currentStreamUrl = streamUrl;
  player = createAudioPlayer(streamUrl);
  player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
    const event = mapStatusToEvent(status);
    if (!event) return;
    const previous = usePlayerStore.getState().state;
    usePlayerStore.getState().applyEvent(event);
    if (event === 'PLAYING') {
      // Only on the transition: the engine reports `playing` on every tick, and
      // this is the denominator every failure rate is measured against.
      if (previous !== 'playing') {
        trackEvent(EVENTS.PLAYBACK_STARTED, { resumed: previous === 'paused' });
      }
      resetReconnectBudget(); // healthy stream
    } else if (event === 'ERROR') {
      handleStreamDrop();
    }
  });

  // Autoplay starts while the permission dialog may still be open, and the
  // foreground service that sustains background audio can only post its
  // notification once POST_NOTIFICATIONS is granted. Re-activate the session
  // when the grant lands so the service is armed for a playback that already
  // began — nothing else would do it, since pushLockScreen is only reachable
  // from play(). Chained after the player exists so it always has one.
  void permission.then((result) => {
    if (generation !== initGeneration) return;
    // Worth reporting on its own: without POST_NOTIFICATIONS the foreground
    // service cannot post, and background audio dies ~18s after a screen lock.
    if (result?.granted === false) trackEvent(EVENTS.NOTIF_PERMISSION_DENIED);
    // Not started yet: play() will arm the session itself.
    if (usePlayerStore.getState().state === 'idle') return;
    pushLockScreen(usePlayerStore.getState().program ?? DEFAULT_NOW_PLAYING);
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
  networkObserved = true; // from here on, the initial snapshot is stale
  lastNetworkState = toNetworkStateLike(state);
  const online =
    lastNetworkState.isConnected && lastNetworkState.isInternetReachable !== false;
  if (awaitingNetwork && online) {
    resetReconnectBudget(); // network restored → not a failed retry, start clean
    reconnect();
  }
}

export function play(): void {
  const state = usePlayerStore.getState().state;
  // Live sync: resuming a paused live stream would play a stale, behind-air
  // buffer, and a stream that errored has no usable source left, so both need a
  // reload to jump back to the live edge. A fresh start is already at the edge.
  if ((state === 'paused' || state === 'error') && player && currentStreamUrl) {
    player.replace(currentStreamUrl);
  }
  // Playing out of `error` IS a manual retry (the mini-player renders a ▶ there),
  // so it takes over the reconnect budget and disarms any armed backoff, which
  // would otherwise fire later and reload the source under a recovered stream.
  if (state === 'error') {
    cancelPendingReconnect();
    resetReconnectBudget();
  }
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

/** A healthy stream, or an explicit user action, restores the full budget. */
function resetReconnectBudget(): void {
  reconnectAttempt = 0;
  awaitingNetwork = false;
  gaveUp = false;
}

/** Disarm the pending backoff reconnect, if any. Safe to call unconditionally. */
function cancelPendingReconnect(): void {
  if (reconnectTimer === null) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

/** Low-level reconnect: reload the live source and play. Does NOT reset backoff. */
function reconnect(): void {
  cancelPendingReconnect();
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
  // `error` stays set on the engine status until the source is replaced, so the
  // listener re-reports the same drop on every tick. Without this guard each
  // tick would arm its own timer and spend an attempt, stacking reconnects and
  // burning the budget to `give-up` in seconds.
  if (reconnectTimer !== null || awaitingNetwork) return;

  const action = reconnectStrategy(reconnectAttempt, lastNetworkState);
  // `gaveUp` silences the REPORTING, never the policy. The repeated error ticks
  // are the only thing that can still carry us to `await-network` if the OS
  // admits the disconnection after the budget is already spent — which is
  // exactly the screen-off WiFi park. Latching the whole handler shut there
  // strands the listener on the error screen until they retry by hand.
  if (!gaveUp) {
    // `offline` is read off the policy's own decision rather than recomputed, so
    // the report can never disagree with what the service actually did.
    trackEvent(EVENTS.STREAM_DROP, {
      attempt: reconnectAttempt,
      offline: action.kind === 'await-network',
    });
  }

  switch (action.kind) {
    case 'await-network':
      awaitingNetwork = true; // onNetworkChange fires reconnect when WiFi returns
      return;
    case 'backoff':
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        reconnect();
      }, action.delayMs);
      return;
    case 'give-up':
      // The one that matters: the listener's radio is dead, and no exception
      // was ever thrown for a crash reporter to catch. Reported once — the
      // status repeats on every tick and this arms no timer to throttle it.
      if (!gaveUp) {
        gaveUp = true;
        trackEvent(EVENTS.STREAM_GIVE_UP, { attempt: reconnectAttempt });
      }
      return; // stays in error; user retries manually
  }
}

/** Manual retry from the error UI: reset backoff and reconnect immediately. */
export function retry(): void {
  resetReconnectBudget();
  reconnect(); // disarms the pending backoff before reloading
}

/** Update now-playing across the store and the lock screen. */
export function setNowPlaying(np: NowPlaying): void {
  usePlayerStore.getState().setProgram(np);
  pushLockScreen(np);
}

/** Free native resources, stop listening for connectivity, clear controls. */
export function teardownAudio(): void {
  // Invalidate any init still in flight so it cannot resurrect what we release.
  initGeneration += 1;
  // Before releasing the player: a timer surviving teardown would push RETRY
  // into the store with no engine behind it, spinning the UI forever.
  cancelPendingReconnect();
  netSubscription?.remove();
  netSubscription = null;
  networkObserved = false;
  resetReconnectBudget();
  player?.clearLockScreenControls();
  player?.remove();
  player = null;
}
