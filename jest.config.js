/**
 * Jest configuration for the LU32 Radio app.
 * Uses the jest-expo preset so Expo SDK 57 / React Native 0.86 modules
 * transform correctly. transformIgnorePatterns whitelists the RN/Expo and
 * third-party ESM packages we rely on so they get transpiled too.
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|zustand|@tanstack/.*))',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
