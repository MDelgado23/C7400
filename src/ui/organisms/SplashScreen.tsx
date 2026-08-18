import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

/** App logo shown, animated, on the loading splash. */
const LOGO_APP = require('../../../assets/logo-app.png');

/** Total time the splash stays on screen before it hands off to the app. */
const DEFAULT_DURATION_MS = 1800;

interface SplashScreenProps {
  /** Fired once when the intro animation finishes — the cue to reveal the app. */
  onFinish: () => void;
  /** How long the splash stays before `onFinish`. Overridable for tests. */
  durationMs?: number;
}

/**
 * Loading splash: the logo fades and scales in, then—after `durationMs`—signals
 * `onFinish`. It owns ONLY the animation and the completion timer; the decision
 * of what happens next (init audio, autoplay, mount the app) lives in the caller.
 *
 * The completion is driven by a plain timer, NOT the animation's own callback, so
 * "when we're done" is deterministic and testable regardless of the Animated
 * driver — the animation is purely visual on top of it.
 */
export function SplashScreen({
  onFinish,
  durationMs = DEFAULT_DURATION_MS,
}: SplashScreenProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(onFinish, durationMs);
    return () => clearTimeout(timer);
  }, [onFinish, durationMs, opacity, scale]);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={LOGO_APP}
        resizeMode="contain"
        accessibilityLabel="LU32"
        style={[styles.logo, { opacity, transform: [{ scale }] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // White (not the dark-navy app background): the Conexion7400 wordmark is a
    // dark-blue mark on a transparent field, so it only reads on a light surface.
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 220,
    height: 220,
  },
});
