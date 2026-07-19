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
import { clamp, easeInOutCubic, easeOutQuad } from './easings';

/** Reference stage the geometry is authored in. */
export const STAGE = { width: 1080, height: 1920 } as const;

/** Logo width on the stage, and the shared image aspect (height / width). */
export const LOGO_W = 940;
export const LOGO_AR = 2481 / 3508;
export const LOGO_H = LOGO_W * LOGO_AR;

/** Ordered scenes with their on-screen durations (seconds). */
export interface SceneDef {
  name: 'Reveal' | 'Finale';
  dur: number;
}
export const SCENES: readonly SceneDef[] = [
  // Reveal holds on the compact "C7400" for the first second (see REVEAL_HOLD),
  // then opens over the rest — no separate mark scene.
  { name: 'Reveal', dur: 2.5 },
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
 * Before 0 → Reveal at 0; at/after TOTAL_DUR → Finale at 1 with `done: true`.
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

// ── Scene 1: Reveal ───────────────────────────────────────────────────────
/**
 * The reveal composes the final logotype from three horizontal slices of the
 * SAME logotype image — the "C", the middle "onexion", and the "7400". It opens
 * from a closed pose (C and 7400 pulled together in the centre, reading "C7400"
 * like the mark, no "onexion") to the open pose (the full "Conexion7400"): the C
 * slides left, the 7400 slides right, and "onexion" wipes open between them. The
 * C and 7400 NEVER disappear.
 *
 * Each slice is a fixed-width window over the logotype; its glyph is picked by
 * `imgLeft` (the window's own image is offset so it always shows that glyph, no
 * matter where the window is positioned). Motion is pure LAYOUT (`left`/`width`)
 * — deliberately NO `transform: scale`, because `overflow: 'hidden'` + a scale
 * transform silently clips to nothing on the New Architecture (Fabric), which
 * is exactly what made the earlier piece-based reveal render blank.
 *
 * The slices tile the logotype perfectly:
 *   C [0, 0.1585) · onexion [0.1585, 0.6289) · 7400 [0.6289, 1] of the width.
 */
export interface Band {
  /** Slice width in stage px. */
  w: number;
  /** Left offset (stage px) of this slice WITHIN the logotype image. */
  imgLeft: number;
}
export const BAND: Record<'C' | 'onexion' | 'seven', Band> = {
  C: { w: 0.1585 * LOGO_W, imgLeft: 0 },
  onexion: { w: 0.4704 * LOGO_W, imgLeft: 0.1585 * LOGO_W },
  seven: { w: 0.3711 * LOGO_W, imgLeft: 0.6289 * LOGO_W },
};

/** Left offset (stage px) of the C when the word is closed (C+7400 centred). */
export const CLOSED_C_LEFT = (LOGO_W - (BAND.C.w + BAND.seven.w)) / 2;

export interface RevealLayout {
  /** Left offset (stage px) of the C slice. */
  cLeft: number;
  /** Left offset of the onexion slice. */
  onexLeft: number;
  /** Width of the onexion slice (0 closed → full open). */
  onexWidth: number;
  /** Left offset of the 7400 slice. */
  sevenLeft: number;
}

/** Slice positions for opening progress `u` (0 = closed/compact, 1 = open). */
export function revealLayout(u: number): RevealLayout {
  'worklet';
  const cLeft = CLOSED_C_LEFT * (1 - u);
  const onexWidth = BAND.onexion.w * u;
  const onexLeft = cLeft + BAND.C.w;
  const sevenLeft = onexLeft + onexWidth;
  return { cLeft, onexLeft, onexWidth, sevenLeft };
}

/** Fraction of the Reveal scene spent holding on the compact "C7400" (~1s). */
export const REVEAL_HOLD = 1.0 / 2.5; // ≈ 0.4 of the 2.5s Reveal scene

export interface RevealFrame {
  /** Opacity of the logotype slices fading in at the start. */
  in2: number;
  /** Opening progress for the slices (0 closed → 1 open). */
  u: number;
}

/**
 * The compact "C7400" fades in, HOLDS for ~1s (REVEAL_HOLD), then the word opens
 * across the rest of the scene: the C slides left, the 7400 slides right, and
 * "onexion" wipes in between them.
 */
export function revealFrame(p: number): RevealFrame {
  'worklet';
  const in2 = clamp(p / 0.06, 0, 1);
  const u = easeInOutCubic(clamp((p - REVEAL_HOLD) / (1 - REVEAL_HOLD), 0, 1));
  return { in2, u };
}

// ── Scene 2: Finale ───────────────────────────────────────────────────────
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
