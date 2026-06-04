const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Redirect expo-apple-authentication to a mock in dev builds where the
// native module isn't compiled in. EAS production builds get the real module.
const appleMock = path.resolve(__dirname, 'src/mocks/apple-auth-mock.js');
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'expo-apple-authentication': appleMock,
};

module.exports = withNativeWind(config, { input: './global.css' });
