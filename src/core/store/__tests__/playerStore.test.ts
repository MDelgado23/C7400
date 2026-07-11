import {
  playerReducer,
  toggleIntent,
  usePlayerStore,
  type PlayerState,
} from '../playerStore';

describe('playerReducer (pure state machine)', () => {
  it('starts playback: idle + PLAY → buffering', () => {
    expect(playerReducer('idle', 'PLAY')).toBe('buffering');
  });

  it('confirms playback: buffering + PLAYING → playing', () => {
    expect(playerReducer('buffering', 'PLAYING')).toBe('playing');
  });

  it('pauses: playing + PAUSE → paused', () => {
    expect(playerReducer('playing', 'PAUSE')).toBe('paused');
  });

  it('resumes: paused + PLAY → buffering', () => {
    expect(playerReducer('paused', 'PLAY')).toBe('buffering');
  });

  it('rebuffers mid-playback: playing + BUFFERING → buffering', () => {
    expect(playerReducer('playing', 'BUFFERING')).toBe('buffering');
  });

  it('errors from any state: playing + ERROR → error', () => {
    expect(playerReducer('playing', 'ERROR')).toBe('error');
    expect(playerReducer('buffering', 'ERROR')).toBe('error');
  });

  it('retries after error: error + RETRY → buffering', () => {
    expect(playerReducer('error', 'RETRY')).toBe('buffering');
  });

  it('ignores nonsensical transitions: idle + PAUSE stays idle', () => {
    expect(playerReducer('idle', 'PAUSE')).toBe('idle');
  });
});

describe('toggleIntent (pure)', () => {
  it('pauses when audio is active', () => {
    expect(toggleIntent('playing')).toBe('pause');
    expect(toggleIntent('buffering')).toBe('pause');
  });

  it('plays when audio is stopped', () => {
    const stopped: PlayerState[] = ['idle', 'paused', 'error'];
    for (const s of stopped) {
      expect(toggleIntent(s)).toBe('play');
    }
  });
});

describe('usePlayerStore', () => {
  beforeEach(() => {
    usePlayerStore.setState({ state: 'idle', program: undefined });
  });

  it('initializes in idle with no program', () => {
    expect(usePlayerStore.getState().state).toBe('idle');
    expect(usePlayerStore.getState().program).toBeUndefined();
  });

  it('applies an event through the reducer', () => {
    usePlayerStore.getState().applyEvent('PLAY');
    expect(usePlayerStore.getState().state).toBe('buffering');
  });

  it('stores now-playing metadata', () => {
    usePlayerStore.getState().setProgram({ title: 'La Mañana de LU32' });
    expect(usePlayerStore.getState().program?.title).toBe('La Mañana de LU32');
  });
});
