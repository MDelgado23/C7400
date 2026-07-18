import {
  DOT_COUNT,
  dotOpacity,
  finaleFrame,
  LOGO_W,
  markFrame,
  PIECES,
  pieceFrame,
  revealFrame,
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
  it('has punch == 1 at both ends (no seam with neighbouring scenes)', () => {
    expect(revealFrame(0).punch).toBeCloseTo(1, 10);
    expect(revealFrame(1).punch).toBeCloseTo(1, 10);
  });

  it('starts with the mark fully shown and the pieces hidden', () => {
    const f = revealFrame(0);
    expect(f.out1).toBeCloseTo(1, 10);
    expect(f.in2).toBe(0);
    expect(f.q).toBe(0);
    expect(f.onexOpacity).toBe(0);
  });

  it('ends with the mark gone and the onexion band fully open', () => {
    const f = revealFrame(1);
    expect(f.out1).toBe(0);
    expect(f.q).toBeCloseTo(1, 10);
    expect(f.onexRightInset).toBeCloseTo(37.11, 2);
  });
});

describe('pieceFrame', () => {
  it('lands every piece on the final logotype at q=1 (no offset, scale 1)', () => {
    for (const key of ['C', 'seven'] as const) {
      const f = pieceFrame(key, 1);
      expect(f.tx).toBeCloseTo(0, 10);
      expect(f.ty).toBeCloseTo(0, 10);
      expect(f.scale).toBeCloseTo(1, 10);
    }
  });

  it('starts each piece at its measured offset and scale (q=0)', () => {
    const c = pieceFrame('C', 0);
    expect(c.tx).toBeCloseTo(PIECES.C.from[0], 10);
    expect(c.scale).toBeCloseTo(PIECES.C.scale, 10);
    // The C sits over the mark scaled UP (mark C is bigger than logotype C).
    expect(c.scale).toBeGreaterThan(1);
  });

  it('moves the 7400 piece leftward from the mark toward the logotype', () => {
    // 7400 in the mark is left of where it lands, so its start tx is negative.
    expect(pieceFrame('seven', 0).tx).toBeLessThan(0);
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
});
