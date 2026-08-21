import { shouldRevealApp } from '../appReadiness';
import type { PlayerState } from '../playerStore';

interface Readiness {
  animationDone: boolean;
  state: PlayerState;
  themeHydrated: boolean;
}

/** Ready on every axis, so a test only has to name the one it is about. */
const READY: Readiness = { animationDone: true, state: 'playing', themeHydrated: true };

const reveal = (overrides: Partial<Readiness> = {}) => {
  const { animationDone, state, themeHydrated } = { ...READY, ...overrides };
  return shouldRevealApp(animationDone, state, themeHydrated);
};

describe('shouldRevealApp', () => {
  it('stays on the splash while the intro animation has not finished', () => {
    expect(reveal({ animationDone: false, state: 'playing' })).toBe(false);
    expect(reveal({ animationDone: false, state: 'error' })).toBe(false);
    expect(reveal({ animationDone: false, state: 'buffering' })).toBe(false);
  });

  it('stays on the splash while the stream is still buffering (covers the loading)', () => {
    expect(reveal({ state: 'idle' })).toBe(false);
    expect(reveal({ state: 'buffering' })).toBe(false);
  });

  it('reveals the app once the stream is actually playing', () => {
    expect(reveal()).toBe(true);
  });

  it('reveals the app on error so the user reaches the retry UI, not a stuck splash', () => {
    expect(reveal({ state: 'error' })).toBe(true);
  });

  it('stays on the splash until the saved theme has been read', () => {
    // Revealing first means painting the default and then repainting a beat
    // later, in front of the user. Under the splash nobody sees it happen — and
    // the disk read finishes in milliseconds, long before the stream connects,
    // so this costs nothing in practice.
    expect(reveal({ themeHydrated: false })).toBe(false);
  });

  it('holds for the theme even when the stream has already failed', () => {
    // The retry UI is a whole screen. Showing it in the wrong theme and
    // correcting it is worse than showing it a few milliseconds later.
    expect(reveal({ state: 'error', themeHydrated: false })).toBe(false);
  });
});
