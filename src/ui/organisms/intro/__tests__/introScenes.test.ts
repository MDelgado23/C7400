import {
  BAND,
  CLOSED_C_LEFT,
  DOT_COUNT,
  dotOpacity,
  finaleFrame,
  LOGO_W,
  MARK_FIT,
  markFrame,
  revealFrame,
  revealLayout,
  SCENES,
  TOTAL_DUR,
  timelineAt,
} from '../introScenes';

describe('timelineAt', () => {
  it('starts on the Mark scene', () => {
    const pos = timelineAt(0);
    expect(pos.name).toBe('Mark');
    expect(pos.progress).toBe(0);
    expect(pos.done).toBe(false);
  });

  it('clamps negative time to the start of the intro', () => {
    expect(timelineAt(-2)).toMatchObject({ name: 'Mark', progress: 0 });
  });

  it('hands off to the next scene exactly on the boundary', () => {
    expect(timelineAt(1.5)).toMatchObject({ name: 'Reveal', progress: 0 });
    expect(timelineAt(3.0)).toMatchObject({ name: 'Finale', progress: 0 });
  });

  it('reports the scene-local time (drives the finale dot loop)', () => {
    expect(timelineAt(3.5).localTime).toBeCloseTo(0.5, 10);
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

describe('markFrame', () => {
  it('starts invisible and small', () => {
    const f = markFrame(0);
    expect(f.opacity).toBe(0);
    expect(f.scale).toBeCloseTo(0.55, 10);
  });

  it('lands on EXACTLY opacity 1 / scale 1 to match Reveal’s first frame', () => {
    const f = markFrame(1);
    expect(f.opacity).toBeCloseTo(1, 10);
    expect(f.scale).toBeCloseTo(1, 10);
  });

  it('is fully opaque by the 16% mark', () => {
    expect(markFrame(0.16).opacity).toBeCloseTo(1, 10);
  });
});

describe('revealFrame', () => {
  it('starts with the mark fully shown and the slices closed/hidden', () => {
    const f = revealFrame(0);
    expect(f.out1).toBeCloseTo(1, 10);
    expect(f.in2).toBe(0);
    expect(f.u).toBe(0);
  });

  it('ends with the mark gone and the word fully open', () => {
    const f = revealFrame(1);
    expect(f.out1).toBe(0);
    expect(f.in2).toBeCloseTo(1, 10);
    expect(f.u).toBeCloseTo(1, 10);
  });

  it('fades the slices in before fading the mark out (no flash at handoff)', () => {
    // Slices reach full opacity while the mark is still (partly) visible.
    expect(revealFrame(0.12).in2).toBeCloseTo(1, 10);
    expect(revealFrame(0.12).out1).toBeGreaterThan(0);
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

  it('shrinks the mark to match the reveal-compact size (no shrink-on-handoff)', () => {
    // The mark's glyphs are larger than the logotype's, so MARK_FIT must be < 1.
    expect(MARK_FIT).toBeGreaterThan(0);
    expect(MARK_FIT).toBeLessThan(1);
    // Sanity: it lands around the measured ~0.57, not a no-op or a near-zero.
    expect(MARK_FIT).toBeGreaterThan(0.45);
    expect(MARK_FIT).toBeLessThan(0.7);
  });
});
