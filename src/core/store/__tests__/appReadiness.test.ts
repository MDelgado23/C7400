import { shouldRevealApp } from '../appReadiness';

describe('shouldRevealApp', () => {
  it('stays on the splash while the intro animation has not finished', () => {
    expect(shouldRevealApp(false, 'playing')).toBe(false);
    expect(shouldRevealApp(false, 'error')).toBe(false);
    expect(shouldRevealApp(false, 'buffering')).toBe(false);
  });

  it('stays on the splash while the stream is still buffering (covers the loading)', () => {
    expect(shouldRevealApp(true, 'idle')).toBe(false);
    expect(shouldRevealApp(true, 'buffering')).toBe(false);
  });

  it('reveals the app once the stream is actually playing', () => {
    expect(shouldRevealApp(true, 'playing')).toBe(true);
  });

  it('reveals the app on error so the user reaches the retry UI, not a stuck splash', () => {
    expect(shouldRevealApp(true, 'error')).toBe(true);
  });
});
