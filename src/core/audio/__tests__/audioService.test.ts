import type { PlaybackStatusLike } from '../statusMapping';

/**
 * audioService unit tests.
 *
 * The service is the impure bridge to expo-audio, so the native modules are
 * mocked and the engine's `playbackStatusUpdate` callback is driven by hand.
 * These cover the reconnect lifecycle — pending timers, repeated drop reports
 * and teardown — which the pure `reconnectPolicy` tests cannot reach: the
 * policy decides *what* to do, this decides *when* and *how many times*.
 */

const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  replace: jest.fn(),
  remove: jest.fn(),
  setActiveForLockScreen: jest.fn(),
  clearLockScreenControls: jest.fn(),
  addListener: jest.fn((event: string, cb: (status: PlaybackStatusLike) => void) => {
    mockListeners[event] = cb;
  }),
};
const mockListeners: Record<string, (status: PlaybackStatusLike) => void> = {};

/** Lets a test hold the permission grant / audio-mode setup in flight. */
const mockAudio: {
  permission: Promise<unknown> | null;
  audioMode: Promise<unknown> | null;
} = { permission: null, audioMode: null };

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => mockPlayer),
  setAudioModeAsync: jest.fn(() => mockAudio.audioMode ?? Promise.resolve(undefined)),
  requestNotificationPermissionsAsync: jest.fn(
    () => mockAudio.permission ?? Promise.resolve({ granted: true }),
  ),
}));

interface NetSnapshot {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

/** Lets a test hold the initial network snapshot in flight and drive the listener. */
const mockNetwork: {
  seed: Promise<NetSnapshot> | null;
  listener: ((state: NetSnapshot) => void) | null;
} = { seed: null, listener: null };

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(
    () =>
      mockNetwork.seed ??
      Promise.resolve({ isConnected: true, isInternetReachable: true }),
  ),
  addNetworkStateListener: jest.fn((cb: (state: NetSnapshot) => void) => {
    mockNetwork.listener = cb;
    return { remove: jest.fn() };
  }),
}));

const STREAM_URL = 'https://stream.lu32.test/live';

type AudioService = typeof import('../audioService');
type PlayerStoreModule = typeof import('../../store/playerStore');

type ObservabilityModule = typeof import('../../observability/observability');

let audio: AudioService;
let store: PlayerStoreModule['usePlayerStore'];
let sink: { logEvent: jest.Mock; logScreen: jest.Mock; recordError: jest.Mock };

/** Fresh module registry so the service's module-level state doesn't leak. */
async function loadService(): Promise<void> {
  jest.resetModules();
  audio = require('../audioService');
  store = (require('../../store/playerStore') as PlayerStoreModule).usePlayerStore;
  // Registered before init so the permission path is observed from the start.
  sink = { logEvent: jest.fn(), logScreen: jest.fn(), recordError: jest.fn() };
  (require('../../observability/observability') as ObservabilityModule).setObservabilitySink(
    sink,
  );
  await audio.initAudio(STREAM_URL);
}

/** Names of the events reported so far, in order. */
function reportedEvents(): string[] {
  return sink.logEvent.mock.calls.map(([name]) => name as string);
}

/** Drive the engine callback the service registered in initAudio. */
function emitStatus(overrides: Partial<PlaybackStatusLike> = {}): void {
  mockListeners.playbackStatusUpdate?.({
    playing: false,
    isBuffering: false,
    timeControlStatus: 'waiting',
    didJustFinish: false,
    error: null,
    ...overrides,
  });
}

/** A stream drop, as the engine reports it. */
function emitDrop(): void {
  emitStatus({ error: 'network down' });
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockNetwork.seed = null;
  mockNetwork.listener = null;
  mockAudio.permission = null;
  mockAudio.audioMode = null;
  await loadService();
});

/** Flush pending microtask chains (the un-awaited init promises). */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
}

afterEach(() => {
  jest.useRealTimers();
});

describe('reconnect scheduling', () => {
  it('does not fire a stale backoff after a manual retry', async () => {
    emitDrop(); // arms a backoff reconnect
    audio.retry(); // user hits "Reintentar" before it fires
    emitStatus({ playing: true, timeControlStatus: 'playing' }); // audio is back
    mockPlayer.replace.mockClear();

    jest.advanceTimersByTime(60_000);

    // The armed timer must have been cancelled: firing it would reload the
    // source and cut live audio that is already playing again.
    expect(mockPlayer.replace).not.toHaveBeenCalled();
    expect(store.getState().state).toBe('playing');
  });

  it('arms a single reconnect when the engine repeats the error status', () => {
    // `error` stays set on the status until the source is replaced, so the
    // listener sees the same drop on every tick.
    emitDrop();
    emitDrop();
    emitDrop();

    jest.advanceTimersByTime(60_000);

    expect(mockPlayer.replace).toHaveBeenCalledTimes(1);
  });

  it('still recovers on its own when the network returns after giving up', () => {
    // The documented root-cause case: on a screen-off WiFi park the OS reports
    // `isInternetReachable: null`, which counts as online, so the whole budget
    // burns against a route that is already dead. Only afterwards does the OS
    // admit it is disconnected.
    for (let i = 0; i < 9; i += 1) {
      emitDrop();
      jest.advanceTimersByTime(60_000);
    }
    mockNetwork.listener?.({ isConnected: false, isInternetReachable: false });
    emitDrop(); // engine still repeating the error, but now it reads as offline
    mockPlayer.replace.mockClear();

    mockNetwork.listener?.({ isConnected: true, isInternetReachable: true });

    // Parking on the network is the ONLY way back: the give-up branch arms no
    // timer. If the drop handler stayed latched shut after giving up, the drop
    // above would never reach `await-network` and the listener would be
    // stranded on the error screen until they tapped retry by hand.
    expect(mockPlayer.replace).toHaveBeenCalled();
  });

  it('does not let a late network snapshot clobber a live listener update', async () => {
    // Cold launch with no connectivity: the initial getNetworkStateAsync snapshot
    // is still in flight when WiFi comes up and the listener reports it.
    let resolveSeed!: (state: NetSnapshot) => void;
    mockNetwork.seed = new Promise<NetSnapshot>((resolve) => {
      resolveSeed = resolve;
    });
    await loadService();

    mockNetwork.listener?.({ isConnected: true, isInternetReachable: true });
    resolveSeed({ isConnected: false, isInternetReachable: false }); // stale
    await Promise.resolve();
    await Promise.resolve();
    mockPlayer.replace.mockClear();

    emitDrop();
    jest.advanceTimersByTime(60_000);

    // The listener is the fresher source, so the drop is online → timed backoff.
    // If the stale snapshot won, the service parks on await-network and, with no
    // further connectivity *change* to fire the listener, never reconnects.
    expect(mockPlayer.replace).toHaveBeenCalled();
  });

  it('cancels a pending reconnect on teardown', () => {
    emitDrop();
    audio.teardownAudio();

    jest.advanceTimersByTime(60_000);

    // A zombie reconnect would push RETRY into the store with no engine behind
    // it, leaving the UI spinning on `buffering` forever.
    expect(store.getState().state).toBe('error');
  });
});

describe('initAudio lifecycle', () => {
  it('re-arms the lock screen when the notification grant lands after playback started', async () => {
    // First Android 13+ launch: POST_NOTIFICATIONS is still being asked while
    // autoplay begins. The media foreground service that keeps background audio
    // alive can only post its notification once the grant is in, so the session
    // has to be activated again — otherwise the OS kills the stream after ~18s
    // and the user gets no lock-screen controls.
    let grant!: () => void;
    mockAudio.permission = new Promise<void>((resolve) => {
      grant = resolve;
    });
    await loadService();

    audio.play(); // autoplay, dialog still unanswered
    mockPlayer.setActiveForLockScreen.mockClear();

    grant();
    await flushMicrotasks();

    expect(mockPlayer.setActiveForLockScreen).toHaveBeenCalled();
  });

  it('abandons an init that a teardown superseded', async () => {
    // App unmounts while the boot effect is still suspended inside initAudio.
    let finishAudioMode!: () => void;
    mockAudio.audioMode = new Promise<void>((resolve) => {
      finishAudioMode = resolve;
    });
    jest.resetModules();
    audio = require('../audioService');
    store = (require('../../store/playerStore') as PlayerStoreModule).usePlayerStore;

    const booting = audio.initAudio(STREAM_URL); // suspends on setAudioModeAsync
    audio.teardownAudio();
    const createAudioPlayer = (require('expo-audio') as { createAudioPlayer: jest.Mock })
      .createAudioPlayer;
    createAudioPlayer.mockClear();

    finishAudioMode();
    await booting;

    // Resuming must not resurrect the player or the connectivity subscription:
    // nothing owns them after teardown, so they would leak past it.
    expect(createAudioPlayer).not.toHaveBeenCalled();
  });

  it('releases the previous player when init runs again without a teardown', async () => {
    mockPlayer.remove.mockClear();

    await audio.initAudio(STREAM_URL); // re-init over a live player

    // Overwriting `player` without releasing it leaves two native players on the
    // same stream — audible double audio on a remount.
    expect(mockPlayer.remove).toHaveBeenCalled();
  });
});

describe('observability', () => {
  it('reports playback starting, once per transition into playing', () => {
    emitStatus({ playing: true, timeControlStatus: 'playing' });
    emitStatus({ playing: true, timeControlStatus: 'playing' }); // still playing

    expect(reportedEvents().filter((e) => e === 'playback_started')).toHaveLength(1);
  });

  it('reports a drop with the attempt count and whether we were offline', () => {
    emitDrop();

    expect(sink.logEvent).toHaveBeenCalledWith('stream_drop', {
      attempt: 0,
      offline: 'false',
    });
  });

  it('reports giving up once the reconnect budget is exhausted', () => {
    // MAX_RECONNECT_ATTEMPTS backoffs, then the next drop gives up. This is the
    // event that matters most: the radio is dead and nothing threw.
    for (let i = 0; i < 9; i += 1) {
      emitDrop();
      jest.advanceTimersByTime(60_000);
    }

    expect(reportedEvents()).toContain('stream_give_up');
  });

  it('falls silent after giving up, however often the engine repeats the error', () => {
    // `error` stays set on the status until the source is replaced, and the
    // give-up branch arms no timer, so nothing throttled the report: every tick
    // emitted another drop AND another give-up. A listener leaving the app open
    // on a dead stream would report at the engine's tick rate forever, and the
    // `attempt` distribution would be swamped by the terminal value.
    for (let i = 0; i < 9; i += 1) {
      emitDrop();
      jest.advanceTimersByTime(60_000);
    }
    expect(reportedEvents()).toContain('stream_give_up');
    const afterGiveUp = sink.logEvent.mock.calls.length;

    for (let i = 0; i < 20; i += 1) emitDrop();

    expect(sink.logEvent.mock.calls).toHaveLength(afterGiveUp);
  });

  it('reports again once a manual retry revives the stream', () => {
    for (let i = 0; i < 9; i += 1) {
      emitDrop();
      jest.advanceTimersByTime(60_000);
    }
    sink.logEvent.mockClear();

    audio.retry();
    emitDrop();

    expect(reportedEvents()).toContain('stream_drop');
  });

  it('does not report giving up while retries remain', () => {
    emitDrop();
    jest.advanceTimersByTime(60_000);

    expect(reportedEvents()).not.toContain('stream_give_up');
  });

  it('reports a refused notification permission', async () => {
    mockAudio.permission = Promise.resolve({ granted: false });
    await loadService();
    await flushMicrotasks();

    expect(reportedEvents()).toContain('notif_permission_denied');
  });

  it('says nothing when the notification permission is granted', async () => {
    mockAudio.permission = Promise.resolve({ granted: true });
    await loadService();
    await flushMicrotasks();

    expect(reportedEvents()).not.toContain('notif_permission_denied');
  });
});

describe('play', () => {
  it('reloads the source and recovers when played from the error state', () => {
    emitDrop();
    expect(store.getState().state).toBe('error');
    mockPlayer.replace.mockClear();

    audio.play(); // the ▶ the mini-player renders in the error state

    expect(mockPlayer.replace).toHaveBeenCalledWith(STREAM_URL);
    expect(mockPlayer.play).toHaveBeenCalled();
    expect(store.getState().state).toBe('buffering');
  });

  it('reloads the source when resuming from pause so playback is at the live edge', () => {
    emitStatus({ playing: true, timeControlStatus: 'playing' });
    audio.pause();
    expect(store.getState().state).toBe('paused');
    mockPlayer.replace.mockClear();

    audio.play();

    expect(mockPlayer.replace).toHaveBeenCalledWith(STREAM_URL);
  });

  it('does not reload the source on a fresh start, which is already live', () => {
    audio.play();

    expect(mockPlayer.replace).not.toHaveBeenCalled();
    expect(store.getState().state).toBe('buffering');
  });
});
