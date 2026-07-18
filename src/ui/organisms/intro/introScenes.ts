/**
 * introScenes — PURE scene math for the Conexion7400 mobile intro.
 *
 * Ported from the Claude Design reference (`conexion-intro.jsx`). The original
 * was React-DOM (clip-path + a web timeline engine); here we keep ONLY the
 * math — every function maps a scene's progress to plain numbers (opacity,
 * scale, translation, clip insets). The React Native component in
 * `ConexionIntro.tsx` consumes these and drives them with Reanimated.
 *
 * All geometry lives in the reference's 1080×1920 "stage" space; the component
 * scales that stage to the device once, so the numbers here never change with
 * screen size.
 *
 * The two source images share the aspect below and carry measured glyph boxes
 * (in the 3508×2481 image space) that the Reveal split relies on:
 *   img1 (mark)      C: x594–1170 c(882,1243)   7400: x1212–2914 c(2063,1259)
 *   img2 (logotype)  C: x260–552  c(406,1140)   7400: x2220–3242 c(2731,1189)
 */
import { clamp, easeInOutCubic, easeInOutQuad, easeOutBack, easeOutQuad } from './easings';

/** Reference stage the geometry is authored in. */
export const STAGE = { width: 1080, height: 1920 } as const;

/** Logo width on the stage, and the shared image aspect (height / width). */
export const LOGO_W = 940;
export const LOGO_AR = 2481 / 3508;
export const LOGO_H = LOGO_W * LOGO_AR;

/** Ordered scenes with their on-screen durations (seconds). */
export interface SceneDef {
  name: 'Mark' | 'Reveal' | 'Finale';
  dur: number;
}
export const SCENES: readonly SceneDef[] = [
  { name: 'Mark', dur: 1.5 },
  { name: 'Reveal', dur: 1.5 },
  { name: 'Finale', dur: 2.2 },
] as const;

/** Total intro duration in seconds. */
export const TOTAL_DUR = SCENES.reduce((sum, s) => sum + s.dur, 0);

export interface TimelinePos {
  /** Index into SCENES of the active scene. */
  index: number;
  name: SceneDef['name'];
  /** 0→1 progress within the active scene. */
  progress: number;
  /** Seconds elapsed within the active scene (drives time-based loops). */
  localTime: number;
  /** True once the whole intro has finished. */
  done: boolean;
}

/**
 * Map global elapsed time (seconds) to the active scene and its local progress.
 * Before 0 → Mark at 0; at/after TOTAL_DUR → Finale at 1 with `done: true`.
 */
export function timelineAt(t: number): TimelinePos {
  'worklet';
  const time = clamp(t, 0, TOTAL_DUR);
  let start = 0;
  for (let i = 0; i < SCENES.length; i++) {
    const scene = SCENES[i];
    const end = start + scene.dur;
    // Last scene owns its closing boundary so t === TOTAL_DUR resolves to it.
    if (time < end || i === SCENES.length - 1) {
      const localTime = time - start;
      return {
        index: i,
        name: scene.name,
        progress: clamp(localTime / scene.dur, 0, 1),
        localTime,
        done: t >= TOTAL_DUR,
      };
    }
    start = end;
  }
  // Unreachable (SCENES is non-empty), but keeps the return type total.
  const last = SCENES[SCENES.length - 1];
  return { index: SCENES.length - 1, name: last.name, progress: 1, localTime: last.dur, done: true };
}

// ── Scene 1: Mark ─────────────────────────────────────────────────────────
export interface MarkFrame {
  opacity: number;
  scale: number;
}

/**
 * The C7400 mark pops in (easeOutBack) and takes one gentle "breath" before
 * settling. By design the last frame is EXACTLY scale 1 / opacity 1 so it
 * matches Reveal's first frame with no visible seam.
 */
export function markFrame(p: number): MarkFrame {
  'worklet';
  const pop = 0.55 + 0.45 * easeOutBack(clamp(p / 0.34, 0, 1));
  const opacity = clamp(p / 0.16, 0, 1);
  // sin(2π·x) returns to 0 at x=1, so the breath vanishes on the final frame.
  const settle = p > 0.34 ? 0.011 * Math.sin(2 * Math.PI * clamp((p - 0.34) / 0.66, 0, 1)) : 0;
  return { opacity, scale: pop + settle };
}

// ── Scene 2: Reveal ───────────────────────────────────────────────────────
/**
 * A glyph "piece" of the full logotype (img2) used to grow the mark into the
 * word: it starts offset/scaled to sit over the mark, then travels to its
 * final spot. `origin`/`clip` are percentages of the img2 box.
 */
export interface PieceSpec {
  /** transform-origin as [x%, y%] of the image box. */
  origin: readonly [number, number];
  /** Starting translation in stage px (reached at q=0). */
  from: readonly [number, number];
  /** Starting scale (reached at q=0); lands at 1 when q=1. */
  scale: number;
  /** Clip inset {top,right,bottom,left} in %, isolating this glyph band. */
  clip: { top: number; right: number; bottom: number; left: number };
}

const K = LOGO_W / 3508; // stage px per image px

export const PIECES: Record<'C' | 'seven', PieceSpec> = {
  C: {
    origin: [(406 / 3508) * 100, (1140 / 2481) * 100],
    from: [(882 - 406) * K, (1243 - 1140) * K],
    scale: 576 / 292,
    clip: { top: 0, right: 84.15, bottom: 0, left: 0 },
  },
  seven: {
    origin: [(2731 / 3508) * 100, (1189 / 2481) * 100],
    from: [(2063 - 2731) * K, (1259 - 1189) * K],
    scale: 1702 / 1022,
    clip: { top: 0, right: 0, bottom: 0, left: 62.89 },
  },
};

/** The "onexion" middle band clip: left inset is fixed, right inset wipes open. */
export const ONEX_LEFT_INSET = 15.85;
const ONEX_RIGHT_HIDDEN = 84.15;
const ONEX_RIGHT_OPEN = 37.11;

export interface PieceFrame {
  tx: number;
  ty: number;
  scale: number;
}

/** Interpolate a piece from its start (q=0) to its landed pose (q=1). */
export function pieceFrame(key: 'C' | 'seven', q: number): PieceFrame {
  'worklet';
  const pc = PIECES[key];
  return {
    tx: pc.from[0] * (1 - q),
    ty: pc.from[1] * (1 - q),
    scale: pc.scale + (1 - pc.scale) * q,
  };
}

export interface RevealFrame {
  /** Whole-group breathing punch; 1 at both ends. */
  punch: number;
  /** Travel-apart progress for the pieces (0 start → 1 landed). */
  q: number;
  /** Opacity of the img2 pieces fading in on top. */
  in2: number;
  /** Opacity of the img1 mark fading out underneath. */
  out1: number;
  /** Opacity of the "onexion" band. */
  onexOpacity: number;
  /** Right inset (%) of the "onexion" band as it wipes open L→R. */
  onexRightInset: number;
}

/**
 * The C and 7400 split apart while "onexion" wipes in between them, everything
 * landing exactly on the final logotype. Pieces fade in ON TOP first, then the
 * mark fades out underneath, so there's no dip/flash at the handoff.
 */
export function revealFrame(p: number): RevealFrame {
  'worklet';
  const punch = 1 + 0.035 * Math.sin(Math.PI * easeInOutQuad(p));
  const q = easeInOutCubic(clamp((p - 0.15) / 0.7, 0, 1));
  const in2 = clamp(p / 0.09, 0, 1);
  const out1 = 1 - clamp((p - 0.1) / 0.14, 0, 1);
  const wipe = easeInOutCubic(clamp((p - 0.28) / 0.55, 0, 1));
  const onexOpacity = clamp((p - 0.26) / 0.12, 0, 1);
  const onexRightInset = ONEX_RIGHT_HIDDEN + (ONEX_RIGHT_OPEN - ONEX_RIGHT_HIDDEN) * wipe;
  return { punch, q, in2, out1, onexOpacity, onexRightInset };
}

// ── Scene 3: Finale ───────────────────────────────────────────────────────
export interface FinaleFrame {
  /** Slow cinematic push-in. */
  zoom: number;
  /** Opacity of the loading-dots row (fades in, then out near the end). */
  dotsIn: number;
}

/** Hold on the logotype with a slow zoom; the dots row fades in then out. */
export function finaleFrame(p: number): FinaleFrame {
  'worklet';
  const zoom = 1 + 0.035 * easeOutQuad(p);
  const dotsIn = clamp((p - 0.22) / 0.2, 0, 1) * (1 - clamp((p - 0.86) / 0.14, 0, 1));
  return { zoom, dotsIn };
}

/** Number of pulsing loading dots in the finale. */
export const DOT_COUNT = 3;

/**
 * Per-dot opacity for the staggered pulse. `localTime` is seconds within the
 * Finale scene; `i` is the dot index. Range settles within [0.25, 0.80].
 */
export function dotOpacity(i: number, localTime: number): number {
  'worklet';
  const phase = Math.sin((localTime * 2.6 - i * 0.55) * Math.PI);
  return 0.25 + 0.55 * Math.max(0, phase);
}
