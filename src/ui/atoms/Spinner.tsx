import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { colors } from '../theme';

interface SpinnerProps {
  /** Outer diameter in px. */
  size?: number;
  /** Ring stroke width. */
  thickness?: number;
  /** Colour of the spinning arc. */
  color?: string;
  /** Colour of the rest of the ring (the faint track). */
  trackColor?: string;
  /** For queries in tests; the visible label lives on the containing control. */
  testID?: string;
}

/**
 * A spinning ring loading indicator — one bright arc over a faint track,
 * rotating continuously. Purely decorative (the accessible "Cargando" label
 * lives on the control that hosts it). Uses the native-driver Animated loop so
 * it never touches the JS thread while spinning.
 */
export function Spinner({
  size = 28,
  thickness = 3,
  color = colors.text,
  trackColor = 'rgba(255, 255, 255, 0.25)',
  testID,
}: SpinnerProps) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 750,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: thickness,
        borderColor: trackColor,
        borderTopColor: color,
        transform: [{ rotate }],
      }}
    />
  );
}
