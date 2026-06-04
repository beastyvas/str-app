// Mock for expo-apple-authentication — used in dev builds where the native module
// isn't compiled in. Production builds get the real native module via EAS.
const AppleAuthenticationButtonType = { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 };
const AppleAuthenticationButtonStyle = { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 };
const AppleAuthenticationScope = { FULL_NAME: 0, EMAIL: 1 };
const AppleAuthenticationOperation = { LOGIN: 0, IMPLICIT: 1, REFRESH: 2, LOGOUT: 3 };

const signInAsync = async () => {
  throw new Error('Apple Authentication not available in this build');
};

const isAvailableAsync = async () => false;

const AppleAuthenticationButton = () => null;

module.exports = {
  signInAsync,
  isAvailableAsync,
  AppleAuthenticationButton,
  AppleAuthenticationButtonType,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationScope,
  AppleAuthenticationOperation,
};
