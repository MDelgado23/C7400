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
  DOT_COUNT,
  dotOpacity,
  finaleFrame,
  LOGO_H,
  LOGO_W,
  markFrame,
  ONEX_LEFT_INSET,
  PIECES,
  pieceFrame,
  revealFrame,
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
 * original used `clip-path`; RN has none, so each glyph band is emulated with an
 * `overflow: 'hidden'` window over a full-size image — no native masking dep.
 *
 * Everything is authored in the reference's 1080×1920 stage space and the whole
 * stage is scaled to the device width once, so the geometry never changes.
 */

// TODO(assets): drop the two source PNGs from the design project's `uploads/`
// folder here — `1.png` (the C7400 mark) and `2.png` (the full logotype).
const IMG_MARK = require('../../../../assets/intro-mark.png'); // uploads/1.png
const IMG_LOGOTYPE = require('../../../../assets/intro-logotype.png'); // uploads/2.png

const NAVY = '#1b3f8f'; // brand navy — the finale loading dots
const BG = '#ffffff'; // the design's stage background

interface ConexionIntroProps {
  /** Fired once when the intro finishes — the cue for App.tsx to reveal. */
  onFinish: () => void;
}

/**
 * One glyph piece of the logotype (the C, or the 7400). A full-size logotype
 * image sits inside an `overflow: 'hidden'` band window (the clip), and the
 * outer full-box view carries the travel/scale transform about the glyph's
 * measured origin — matching the CSS `clip-path` + `transform` of the source.
 */
function Piece({ keyName, clock }: { keyName: 'C' | 'seven'; clock: SharedValue<number> }) {
  const spec = PIECES[keyName];
  const bandLeft = (spec.clip.left / 100) * LOGO_W;
  const bandTop = (spec.clip.top / 100) * LOGO_H;
  const bandW = ((100 - spec.clip.left - spec.clip.right) / 100) * LOGO_W;
  const bandH = ((100 - spec.clip.top - spec.clip.bottom) / 100) * LOGO_H;

  const style = useAnimatedStyle(() => {
    const pos = timelineAt(clock.value);
    const active = pos.name === 'Reveal';
    const f = revealFrame(active ? pos.progress : 0);
    const pf = pieceFrame(keyName, f.q);
    return {
      opacity: active ? f.in2 : 0,
      transform: [{ translateX: pf.tx }, { translateY: pf.ty }, { scale: pf.scale }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.fill,
        { transformOrigin: `${spec.origin[0]}% ${spec.origin[1]}%` },
        style,
      ]}>
      <View style={{ position: 'absolute', left: bandLeft, top: bandTop, width: bandW, height: bandH, overflow: 'hidden' }}>
        <Image source={IMG_LOGOTYPE} resizeMode="stretch" style={{ position: 'absolute', left: -bandLeft, top: -bandTop, width: LOGO_W, height: LOGO_H }} />
      </View>
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

  // Scene 2 — the whole reveal group "breathes" (punch == 1 at both ends).
  const revealGroupStyle = useAnimatedStyle(() => {
    const pos = timelineAt(clock.value);
    const active = pos.name === 'Reveal';
    const f = revealFrame(active ? pos.progress : 0);
    return { opacity: active ? 1 : 0, transform: [{ scale: f.punch }] };
  });

  // The "onexion" middle band wiping open left→right (animated window width).
  const onexStyle = useAnimatedStyle(() => {
    const pos = timelineAt(clock.value);
    const f = revealFrame(pos.name === 'Reveal' ? pos.progress : 0);
    const w = ((100 - ONEX_LEFT_INSET - f.onexRightInset) / 100) * LOGO_W;
    return { width: Math.max(0, w), opacity: f.onexOpacity };
  });

  // The mark fading out UNDER the pieces once they're fully opaque.
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

  const onexLeftPx = (ONEX_LEFT_INSET / 100) * LOGO_W;

  return (
    <View style={styles.root}>
      <View style={{ width: STAGE.width, height: STAGE.height, transform: [{ scale: stageScale }] }}>
        <View style={styles.center}>
          <View style={styles.logoBox}>
            {/* Scene 1 */}
            <Animated.Image source={IMG_MARK} resizeMode="stretch" style={[styles.fill, markStyle]} />

            {/* Scene 2 */}
            <Animated.View style={[styles.fill, revealGroupStyle]}>
              <Animated.View style={[{ position: 'absolute', left: onexLeftPx, top: 0, height: LOGO_H, overflow: 'hidden' }, onexStyle]}>
                <Image source={IMG_LOGOTYPE} resizeMode="stretch" style={{ position: 'absolute', left: -onexLeftPx, top: 0, width: LOGO_W, height: LOGO_H }} />
              </Animated.View>
              <Piece keyName="C" clock={clock} />
              <Piece keyName="seven" clock={clock} />
              <Animated.Image source={IMG_MARK} resizeMode="stretch" style={[styles.fill, revealMarkStyle]} />
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
