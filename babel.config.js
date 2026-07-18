module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Reanimated 4 moved the worklets compiler into react-native-worklets.
      // Must stay last in the plugin list.
      'react-native-worklets/plugin',
    ],
  };
};
