/**
 * Global test setup. @testing-library/react-native v14 ships its matchers
 * built-in, so this file is the place for global mocks.
 */

// AsyncStorage is a native module: without this every suite that reaches the
// sponsors cache would fail on a null bridge rather than on anything real. The
// package ships this in-memory implementation for exactly that.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/**
 * Gesture handler, reduced to the parts a rendering test can mean anything to.
 *
 * Its real GestureDetector reaches deep into reanimated's worklet internals —
 * `useEvent` and friends — and mocking those one at a time is chasing an
 * implementation, not testing behaviour. NOTHING about a gesture can be
 * asserted here anyway: there is no touch, no velocity, no UI thread. So the
 * detector becomes a passthrough and the builders become no-ops, which is
 * exactly as much as a test without fingers deserves.
 *
 * Whether a pinch actually zooms is a question for a device, and it is checked
 * there.
 */
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  /** Every builder method returns the builder, so chains keep working. */
  const chainable = (): Record<string, unknown> => {
    const self: Record<string, unknown> = {};
    for (const method of [
      'onBegin',
      'onStart',
      'onUpdate',
      'onEnd',
      'onFinalize',
      'numberOfTaps',
      'minDistance',
      'enabled',
    ]) {
      self[method] = () => self;
    }
    return self;
  };
  return {
    GestureHandlerRootView: View,
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: {
      Pinch: chainable,
      Pan: chainable,
      Tap: chainable,
      Simultaneous: chainable,
      Exclusive: chainable,
      Race: chainable,
    },
    State: {},
    Directions: {},
  };
});

/**
 * Reanimated boots its worklets runtime the moment it is imported, against a
 * native bridge that does not exist here, and throws before a single test runs.
 * The stand-in the package ships is not self-contained — it pulls the same
 * runtime back in — so this is the smallest thing that behaves correctly for a
 * RENDERING test: shared values are plain boxes and the style function is
 * evaluated once, on the spot.
 *
 * It does not animate, and nothing here should ever assert that it does. What
 * a transform looks like mid-gesture is a question for a device.
 */
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  // gesture-handler wraps its detector in one of these, so it has to exist.
  const createAnimatedComponent = (component: unknown) => component;
  return {
    __esModule: true,
    default: { View, createAnimatedComponent },
    createAnimatedComponent,
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: (build: () => unknown) => build(),
    withTiming: (value: unknown) => value,
    withSpring: (value: unknown) => value,
    runOnJS: (fn: unknown) => fn,
  };
});

export {};
