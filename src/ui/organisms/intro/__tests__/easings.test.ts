import { clamp, easeInOutCubic, easeInOutQuad, easeOutBack, easeOutQuad } from '../easings';

describe('clamp', () => {
  it('passes values already inside the range through', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('pins values to the bounds', () => {
    expect(clamp(-3, 0, 1)).toBe(0);
    expect(clamp(9, 0, 1)).toBe(1);
  });
});

describe('easeOutBack', () => {
  it('anchors at 0 and 1 so scenes start/end exactly on their poses', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 10);
    expect(easeOutBack(1)).toBeCloseTo(1, 10);
  });

  it('overshoots past 1 before settling (the "pop")', () => {
    const peak = Math.max(...[0.6, 0.7, 0.8].map(easeOutBack));
    expect(peak).toBeGreaterThan(1);
  });
});

describe('easeInOutQuad', () => {
  it('is symmetric: 0→0, 0.5→0.5, 1→1', () => {
    expect(easeInOutQuad(0)).toBeCloseTo(0, 10);
    expect(easeInOutQuad(0.5)).toBeCloseTo(0.5, 10);
    expect(easeInOutQuad(1)).toBeCloseTo(1, 10);
  });
});

describe('easeInOutCubic', () => {
  it('is symmetric: 0→0, 0.5→0.5, 1→1', () => {
    expect(easeInOutCubic(0)).toBeCloseTo(0, 10);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
    expect(easeInOutCubic(1)).toBeCloseTo(1, 10);
  });
});

describe('easeOutQuad', () => {
  it('anchors at 0 and 1', () => {
    expect(easeOutQuad(0)).toBeCloseTo(0, 10);
    expect(easeOutQuad(1)).toBeCloseTo(1, 10);
  });

  it('decelerates: past the halfway output before the halfway input', () => {
    expect(easeOutQuad(0.5)).toBeGreaterThan(0.5);
  });
});
