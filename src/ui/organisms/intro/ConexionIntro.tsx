import { useEffect } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  BAND,
  DOT_COUNT,
  dotOpacity,
  finaleFrame,
  LOGO_H,
  LOGO_W,
  markFrame,
  revealFrame,
  revealLayout,
  STAGE,
  timelineAt,
  TOTAL_DUR,
} from './introScenes';

/**
 * ConexionIntro — the Conexion7400 launch intro, ported to React Native from
 * the Claude Design reference (`Conexion Intro.dc.html`).
 *
 * DROP-IN for SplashScreen: same `onFinish` contract, so App.tsx keeps holding
 * the reveal until the animation is done AND the stream is playing.
 *
 * All motion is driven by a single Reanimated `clock` (seconds, 0 → TOTAL_DUR)
 * on the UI thread; every layer reads it through a worklet and derives its pose
 * from the PURE scene math in `introScenes.ts` (unit-tested separately). The web
 * original used `clip-path`; RN has none, so each glyph slice is an
 * `overflow: 'hidden'` window over a full-size image — no native masking dep.
 * The reveal animates those windows with LAYOUT props (`left`/`width`) ONLY:
 * `overflow: 'hidden'` + a `transform: scale` clips to nothing on Fabric, which
 * is what made an earlier transform-based reveal render blank.
 *
 * Everything is authored in the reference's 1080×1920 stage space and the whole
 * stage is scaled to the device width once, so the geometry never changes.
 */

const IMG_MARK = require('../../../../assets/intro-mark.png'); // uploads/1.png — "C7400"
const IMG_LOGOTYPE = require('../../../../assets/intro-logotype.png'); // uploads/2.png — "Conexion7400"

const NAVY = '#1b3f8f'; // brand navy — the finale loading dots
const BG = '#ffffff'; // the design's stage background

interface ConexionIntroProps {
  /** Fired once when the intro finishes — the cue for App.tsx to reveal. */
  onFinish: () => void;
}

/**
 * One horizontal slice of the logotype (the C, the middle "onexion", or the
 * 7400). The window clips to the slice via `overflow: 'hidden'`; the image
 * inside is offset by `imgLeft` so the window always shows THIS glyph, wherever
 * the window is positioned. The C and 7400 keep a fixed width and only slide
 * (`left`); "onexion" holds its left and grows its `width`. All layout — no
 * transforms — so nothing can be clipped away on Fabric.
 */
function RevealSlice({ which, clock }: { which: 'C' | 'onexion' | 'seven'; clock: SharedValue<number> }) {
  const band = BAND[which];
  const style = useAnimatedStyle(() => {
    const pos = timelineAt(clock.value);
    const active = pos.name === 'Reveal';
    const f = revealFrame(active ? pos.progress : 0);
    const lay = revealLayout(f.u);
    const opacity = active ? f.in2 : 0;
    if (which === 'C') return { left: lay.cLeft, width: band.w, opacity };
    if (which === 'seven') return { left: lay.sevenLeft, width: band.w, opacity };
    return { left: lay.onexLeft, width: lay.onexWidth, opacity }; // onexion
  });

  return (
    <Animated.View style={[{ position: 'absolute', top: 0, height: LOGO_H, overflow: 'hidden' }, style]}>
      <Image
        source={IMG_LOGOTYPE}
        resizeMode="stretch"
        style={{ position: 'absolute', left: -band.imgLeft, top: 0, width: LOGO_W, height: LOGO_H }}
      />
    </Animated.View>
  );
}

/** A single pulsing loading dot in the finale (staggered by index). */
function Dot({ index, clock }: { index: number; clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const pos = timelineAt(clock.value);
    const localTime = pos.name === 'Finale' ? pos.localTime : 0;
    return { opacity: dotOpacity(index, localTime) };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

export function ConexionIntro({ onFinish }: ConexionIntroProps) {
  const { width } = useWindowDimensions();
  const stageScale = width / STAGE.width;
  const reduceMotion = useReducedMotion();
  const clock = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      // Respect the OS "reduce motion" setting: skip straight to the finished
      // logotype and hand off after a short, static hold.
      clock.value = TOTAL_DUR;
      const t = setTimeout(onFinish, 900);
      return () => clearTimeout(t);
    }
    clock.value = withTiming(
      TOTAL_DUR,
      { duration: TOTAL_DUR * 1000, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(onFinish)();
      },
    );
    return undefined;
  }, [clock, onFinish, reduceMotion]);

  // Scene 1 — the mark pops in and settles.
  const markStyle = useAnimatedStyle(() => {
    const pos = timelineAt(clock.value);
    if (pos.name !== 'Mark') return { opacity: 0 };
    const f = markFrame(pos.progress);
    return { opacity: f.opacity, transform: [{ scale: f.scale }] };
  });

  // Scene 2 — the reveal group is just shown/hidden; the slices carry the motion.
  const revealGroupStyle = useAnimatedStyle(() => {
    const pos = timelineAt(clock.value);
    return { opacity: pos.name === 'Reveal' ? 1 : 0 };
  });

  // The mark fading out UNDER the slices once they're fully opaque.
  const revealMarkStyle = useAnimatedStyle(() => {
    const pos = timelineAt(clock.value);
    const f = revealFrame(pos.name === 'Reveal' ? pos.progress : 0);
    return { opacity: f.out1 };
  });

  // Scene 3 — hold on the logotype with a slow push-in.
  const finaleLogoStyle = useAnimatedStyle(() => {
    const pos = timelineAt(clock.value);
    const active = pos.name === 'Finale';
    const f = finaleFrame(active ? pos.progress : 0);
    return { opacity: active ? 1 : 0, transform: [{ scale: f.zoom }] };
  });

  const dotsRowStyle = useAnimatedStyle(() => {
    const pos = timelineAt(clock.value);
    const f = finaleFrame(pos.name === 'Finale' ? pos.progress : 0);
    return { opacity: f.dotsIn };
  });

  return (
    <View style={styles.root}>
      <View style={{ width: STAGE.width, height: STAGE.height, transform: [{ scale: stageScale }] }}>
        <View style={styles.center}>
          <View style={styles.logoBox}>
            {/* Scene 1 */}
            <Animated.Image source={IMG_MARK} resizeMode="stretch" style={[styles.fill, markStyle]} />

            {/* Scene 2 — mark fades out underneath; the three slices open the word on top */}
            <Animated.View style={[styles.fill, revealGroupStyle]}>
              <Animated.Image source={IMG_MARK} resizeMode="stretch" style={[styles.fill, revealMarkStyle]} />
              <RevealSlice which="C" clock={clock} />
              <RevealSlice which="onexion" clock={clock} />
              <RevealSlice which="seven" clock={clock} />
            </Animated.View>

            {/* Scene 3 */}
            <Animated.Image source={IMG_LOGOTYPE} resizeMode="stretch" style={[styles.fill, finaleLogoStyle]} />
          </View>
        </View>

        <Animated.View style={[styles.dotsRow, dotsRowStyle]}>
          {Array.from({ length: DOT_COUNT }, (_, i) => (
            <Dot key={i} index={i} clock={clock} />
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
    overflow: 'hidden',
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    width: LOGO_W,
    height: LOGO_H,
  },
  fill: {
    position: 'absolute',
    width: LOGO_W,
    height: LOGO_H,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 430,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: NAVY,
  },
});
