import { useEffect } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../ui/atoms/AppText';
import { colors, spacing } from '../../ui/theme';

interface PhotoViewerProps {
  /** The photo to show, or null when nothing is open. */
  uri: string | null;
  onClose: () => void;
}

/** How far in and out the photo may be taken. */
const MIN_SCALE = 1;
const MAX_SCALE = 4;

/**
 * A photo on its own, as big as the screen allows.
 *
 * The article's frame is shaped like the photo but capped in height, so a very
 * tall one still loses its edges to make room for the headline. THIS is where
 * the whole photo lives: nothing cropped, and pinch and drag for the parts of a
 * poster or a scoreboard that a phone-sized frame makes unreadable.
 *
 * A GestureHandlerRootView is mounted INSIDE the Modal on purpose. On Android a
 * Modal is its own native window, and the root at the top of the app does not
 * reach into it — without this the gestures are simply dead, silently.
 */
export function PhotoViewer({ uri, onClose }: PhotoViewerProps) {
  // The modal draws edge to edge, so the close button and the hint have to
  // clear the system bars themselves — nothing else is going to.
  const safeArea = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  /**
   * A fresh photo opens at rest.
   *
   * These values live above the Modal and outlive it, so without this the next
   * photo opens zoomed into the corner the last one was left in.
   */
  useEffect(() => {
    scale.value = 1;
    startScale.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
    startX.value = 0;
    startY.value = 0;
  }, [uri, scale, startScale, offsetX, offsetY, startX, startY]);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(Math.max(startScale.value * event.scale, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      startScale.value = scale.value;
      // Back to the middle when it is all the way out: a photo at rest sitting
      // off to one side reads as broken rather than as panned.
      if (scale.value <= MIN_SCALE) {
        offsetX.value = withTiming(0);
        offsetY.value = withTiming(0);
        startX.value = 0;
        startY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      // Dragging only means something once there is more photo than screen.
      if (scale.value <= MIN_SCALE) return;
      offsetX.value = startX.value + event.translationX;
      offsetY.value = startY.value + event.translationY;
    })
    .onEnd(() => {
      startX.value = offsetX.value;
      startY.value = offsetY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > MIN_SCALE ? MIN_SCALE : 2;
      scale.value = withTiming(next);
      startScale.value = next;
      offsetX.value = withTiming(0);
      offsetY.value = withTiming(0);
      startX.value = 0;
      startY.value = 0;
    });

  const gestures = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animated = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal
      visible={uri !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.backdrop}>
          {uri !== null ? (
            <GestureDetector gesture={gestures}>
              <Animated.View
                style={[styles.stage, animated]}
                accessible
                accessibilityLabel="Pellizcá para ampliar la foto, arrastrá para moverla"
              >
                <Image
                  testID="photo-viewer-image"
                  source={{ uri }}
                  style={styles.photo}
                  resizeMode="contain"
                />
              </Animated.View>
            </GestureDetector>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={onClose}
            hitSlop={16}
            style={[styles.close, { top: safeArea.top + spacing.sm }]}
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>

          <AppText
            variant="caption"
            muted
            style={[styles.hint, { bottom: safeArea.bottom + spacing.lg }]}
          >
            Pellizcá para ampliar · tocá dos veces para acercar
          </AppText>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  /*
   * FULLY opaque, and it has to be. At 94% the article showed through — the
   * headline, the mini-player, the tab bar — all of it faintly legible behind
   * the photo the reader opened precisely to look at without distraction.
   * Black rather than the app's navy: nothing should compete with the photo.
   */
  backdrop: { flex: 1, backgroundColor: '#000' },
  stage: { flex: 1 },
  photo: { flex: 1, width: '100%' },
  close: {
    position: 'absolute',
    right: spacing.md,
    padding: spacing.sm,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
