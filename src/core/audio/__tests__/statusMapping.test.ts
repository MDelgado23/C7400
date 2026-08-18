import { mapStatusToEvent, type PlaybackStatusLike } from '../statusMapping';

/** Builds a status object; defaults to a neutral (idle/waiting) state. */
function status(overrides: Partial<PlaybackStatusLike> = {}): PlaybackStatusLike {
  return {
    playing: false,
    isBuffering: false,
    timeControlStatus: 'waiting',
    didJustFinish: false,
    error: null,
    ...overrides,
  };
}

describe('mapStatusToEvent (pure status → event)', () => {
  it('maps an engine error to ERROR', () => {
    expect(mapStatusToEvent(status({ error: 'network down' }))).toBe('ERROR');
  });

  it('maps a finished live stream (dropped) to ERROR', () => {
    expect(mapStatusToEvent(status({ didJustFinish: true }))).toBe('ERROR');
  });

  it('maps initial buffering (not yet playing) to BUFFERING', () => {
    expect(mapStatusToEvent(status({ isBuffering: true, playing: false }))).toBe('BUFFERING');
  });

  it('maps active playback to PLAYING', () => {
    expect(mapStatusToEvent(status({ playing: true, timeControlStatus: 'playing' }))).toBe(
      'PLAYING',
    );
  });

  it('maps a rebuffer during playback to BUFFERING', () => {
    // engine dropped out of playback and is refilling the buffer
    expect(mapStatusToEvent(status({ playing: false, isBuffering: true }))).toBe('BUFFERING');
  });

  it('maps paused (via timeControlStatus) to PAUSE', () => {
    expect(mapStatusToEvent(status({ timeControlStatus: 'paused' }))).toBe('PAUSE');
  });

  it('keeps PAUSE when the engine is still buffering under an explicit pause', () => {
    // Pausing mid-rebuffer is the common case on a flaky live stream: the engine
    // reports isBuffering until the source is released. Reporting BUFFERING here
    // flips the store out of `paused`, and toggleIntent('buffering') is 'pause',
    // so the next tap pauses again and the user can never resume.
    expect(
      mapStatusToEvent(status({ isBuffering: true, playing: false, timeControlStatus: 'paused' })),
    ).toBe('PAUSE');
  });

  it('returns null when nothing meaningful changed', () => {
    expect(mapStatusToEvent(status())).toBeNull();
  });

  it('prioritizes ERROR over an otherwise-playing status', () => {
    expect(mapStatusToEvent(status({ playing: true, error: 'boom' }))).toBe('ERROR');
  });
});
