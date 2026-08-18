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

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => mockPlayer),
  setAudioModeAsync: jest.fn(async () => undefined),
  requestNotificationPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
  })),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const STREAM_URL = 'https://stream.lu32.test/live';

type AudioService = typeof import('../audioService');
type PlayerStoreModule = typeof import('../../store/playerStore');

let audio: AudioService;
let store: PlayerStoreModule['usePlayerStore'];

/** Fresh module registry so the service's module-level state doesn't leak. */
async function loadService(): Promise<void> {
  jest.resetModules();
  audio = require('../audioService');
  store = (require('../../store/playerStore') as PlayerStoreModule).usePlayerStore;
  await audio.initAudio(STREAM_URL);
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
  await loadService();
});

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

  it('cancels a pending reconnect on teardown', () => {
    emitDrop();
    audio.teardownAudio();

    jest.advanceTimersByTime(60_000);

    // A zombie reconnect would push RETRY into the store with no engine behind
    // it, leaving the UI spinning on `buffering` forever.
    expect(store.getState().state).toBe('error');
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
