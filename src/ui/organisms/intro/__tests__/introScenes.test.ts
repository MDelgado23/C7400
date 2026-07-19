import {
  BAND,
  CLOSED_C_LEFT,
  DOT_COUNT,
  dotOpacity,
  finaleFrame,
  LOGO_W,
  revealFrame,
  revealLayout,
  REVEAL_HOLD,
  SCENES,
  TOTAL_DUR,
  timelineAt,
} from '../introScenes';

describe('timelineAt', () => {
  it('starts on the Reveal scene', () => {
    const pos = timelineAt(0);
    expect(pos.name).toBe('Reveal');
    expect(pos.progress).toBe(0);
    expect(pos.done).toBe(false);
  });

  it('clamps negative time to the start of the intro', () => {
    expect(timelineAt(-2)).toMatchObject({ name: 'Reveal', progress: 0 });
  });

  it('hands off to the finale exactly on the boundary', () => {
    expect(timelineAt(2.5)).toMatchObject({ name: 'Finale', progress: 0 });
  });

  it('reports the scene-local time (drives the finale dot loop)', () => {
    expect(timelineAt(3.0).localTime).toBeCloseTo(0.5, 10);
  });

  it('ends done on the last scene at full progress', () => {
    const end = timelineAt(TOTAL_DUR);
    expect(end.name).toBe('Finale');
    expect(end.progress).toBe(1);
    expect(end.done).toBe(true);
  });

  it('stays done past the end', () => {
    expect(timelineAt(TOTAL_DUR + 10).done).toBe(true);
  });

  it('sums the scene durations into the total', () => {
    expect(TOTAL_DUR).toBeCloseTo(
      SCENES.reduce((s, sc) => s + sc.dur, 0),
      10,
    );
  });
});

describe('revealFrame', () => {
  it('starts hidden and closed', () => {
    const f = revealFrame(0);
    expect(f.in2).toBe(0);
    expect(f.u).toBe(0);
  });

  it('fades the compact word in quickly at the very start', () => {
    expect(revealFrame(0.06).in2).toBeCloseTo(1, 10);
  });

  it('HOLDS on the compact word (u stays 0) through the ~1s pause', () => {
    expect(revealFrame(REVEAL_HOLD / 2).u).toBe(0);
    expect(revealFrame(REVEAL_HOLD).u).toBe(0);
  });

  it('opens only after the hold', () => {
    expect(revealFrame(REVEAL_HOLD + 0.2).u).toBeGreaterThan(0);
  });

  it('ends fully open and visible', () => {
    const f = revealFrame(1);
    expect(f.in2).toBeCloseTo(1, 10);
    expect(f.u).toBeCloseTo(1, 10);
  });
});

describe('the reveal slices tile the logotype', () => {
  it('the three band widths sum to the full logo width', () => {
    expect(BAND.C.w + BAND.onexion.w + BAND.seven.w).toBeCloseTo(LOGO_W, 6);
  });
});

describe('revealLayout', () => {
  it('opens to the exact final logotype tiling at u=1', () => {
    const l = revealLayout(1);
    expect(l.cLeft).toBeCloseTo(0, 10);
    expect(l.onexLeft).toBeCloseTo(BAND.C.w, 10);
    expect(l.onexWidth).toBeCloseTo(BAND.onexion.w, 10);
    expect(l.sevenLeft).toBeCloseTo(BAND.C.w + BAND.onexion.w, 10);
  });

  it('closes to a centred C7400 with no onexion at u=0', () => {
    const l = revealLayout(0);
    expect(l.cLeft).toBeCloseTo(CLOSED_C_LEFT, 10);
    expect(l.onexWidth).toBe(0);
    // C and 7400 sit flush against each other (nothing between them).
    expect(l.sevenLeft).toBeCloseTo(l.cLeft + BAND.C.w, 10);
  });

  it('opens the word: C slides left and 7400 slides right, onexion grows', () => {
    const start = revealLayout(0);
    const end = revealLayout(1);
    expect(end.cLeft).toBeLessThan(start.cLeft); // C moves left
    expect(end.sevenLeft).toBeGreaterThan(start.sevenLeft); // 7400 moves right
    expect(end.onexWidth).toBeGreaterThan(start.onexWidth); // onexion opens
  });

  it('keeps the C and 7400 slices at full width throughout (never vanish)', () => {
    // Widths are fixed constants; only positions animate — the glyphs can't
    // disappear mid-reveal (the bug this replaced).
    expect(BAND.C.w).toBeGreaterThan(0);
    expect(BAND.seven.w).toBeGreaterThan(0);
  });
});

describe('finaleFrame', () => {
  it('starts at rest and pushes in slightly', () => {
    expect(finaleFrame(0).zoom).toBeCloseTo(1, 10);
    expect(finaleFrame(1).zoom).toBeCloseTo(1.035, 10);
  });

  it('keeps the dots hidden at the start and fades them out by the end', () => {
    expect(finaleFrame(0).dotsIn).toBe(0);
    expect(finaleFrame(1).dotsIn).toBeCloseTo(0, 10);
  });

  it('shows the dots through the middle of the hold', () => {
    expect(finaleFrame(0.5).dotsIn).toBeGreaterThan(0.5);
  });
});

describe('dotOpacity', () => {
  it('stays within the designed pulse band for every dot', () => {
    for (let i = 0; i < DOT_COUNT; i++) {
      for (let t = 0; t <= 2; t += 0.05) {
        const a = dotOpacity(i, t);
        expect(a).toBeGreaterThanOrEqual(0.25 - 1e-9);
        expect(a).toBeLessThanOrEqual(0.8 + 1e-9);
      }
    }
  });
});

describe('geometry constants', () => {
  it('keeps the logo within the reference stage width', () => {
    expect(LOGO_W).toBeLessThan(1080);
  });

  it('spends about a second holding on the compact word before opening', () => {
    // REVEAL_HOLD is a fraction of the 2.5s Reveal scene ≈ 1s.
    expect(SCENES[0].name).toBe('Reveal');
    expect(REVEAL_HOLD * SCENES[0].dur).toBeCloseTo(1.0, 6);
  });
});
