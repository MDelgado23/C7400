import { backgroundPlaybackAtRisk } from '../backgroundPlayback';

describe('backgroundPlaybackAtRisk (pure)', () => {
  it('is at risk when battery optimization is enabled (app NOT exempt)', () => {
    expect(backgroundPlaybackAtRisk(true)).toBe(true);
  });

  it('is safe when the app is exempt from battery optimization', () => {
    expect(backgroundPlaybackAtRisk(false)).toBe(false);
  });

  it('is NOT flagged when optimization state is unknown (null) — never nag blindly', () => {
    expect(backgroundPlaybackAtRisk(null)).toBe(false);
  });
});
