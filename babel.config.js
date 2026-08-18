module.exports = function (api) {
  api.cache(true);
  return {
    // Reanimated 4 moved its worklet transform into react-native-worklets, and
    // babel-preset-expo already resolves and appends that plugin on its own when
    // the package is installed (see babel-preset-expo/build/configs/expo.js).
    // Listing it here again registered the transform twice, so it is left to the
    // preset — which also keeps it correctly ordered last.
    presets: ['babel-preset-expo'],
  };
};
