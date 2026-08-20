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

export {};
