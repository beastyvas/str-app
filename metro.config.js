const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// In dev builds the expo-apple-authentication native module isn't compiled in,
// so Metro can't resolve its native stub. Use a mock to keep the bundle working.
// Production EAS builds (NODE_ENV=production) compile the real native module — no mock needed.
if (process.env.NODE_ENV !== 'production') {
  const appleMock = path.resolve(__dirname, 'src/mocks/apple-auth-mock.js');
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'expo-apple-authentication': appleMock,
  };
}

module.exports = withNativeWind(config, { input: './global.css' });
