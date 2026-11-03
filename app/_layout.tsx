import '../global.css';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
// Per-weight entry points: the package roots require EVERY weight, which
// would ship ~30 unused TTFs in every bundle / OTA update.
import { DelaGothicOne_400Regular } from '@expo-google-fonts/dela-gothic-one/400Regular';
import { ChakraPetch_600SemiBold } from '@expo-google-fonts/chakra-petch/600SemiBold';
import { ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch/700Bold';
import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { WorldProvider } from '@/theme';
import { ImpactFrame } from '@/components/anime';
import { CameoRoot } from '@/components/cameo';
import { Colors, Fonts } from '@/constants/theme';

// Initialize RevenueCat — skip in Expo Go (purchases only work in real builds)
const isExpoGo = Constants.appOwnership === 'expo';
if (!isExpoGo) {
  try {
    const Purchases = require('react-native-purchases').default;
    const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    if (apiKey && Platform.OS === 'ios') {
      Purchases.configure({ apiKey });
    }
  } catch {
    // RC not available
  }
}

SplashScreen.preventAutoHideAsync();

function RootLayoutNav({ fontsReady }: { fontsReady: boolean }) {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Hold the splash until both auth and the custom fonts are ready, so the
    // first frame never renders in the system font.
    if (loading || !fontsReady) return;
    SplashScreen.hideAsync();

    const inAuth = segments[0] === '(auth)';

    if (!session) {
      if (!inAuth) router.replace('/(auth)/login');
    } else if (session && !profile) {
      // Session exists but profile still loading — wait, don't flash onboarding
      return;
    } else if (!profile?.bodyweight_lbs) {
      router.replace('/(auth)/onboarding');
    } else {
      if (inAuth) router.replace('/(tabs)');
    }
  }, [session, profile, loading, fontsReady]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="exercise/[id]"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="workout/summary"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      {__DEV__ && <Stack.Screen name="dev/worlds" options={{ presentation: 'modal' }} />}
    </Stack>
  );
}

export default function RootLayout() {
  // Fonts ship as JS assets (expo-font is already in the binary), so font
  // changes are OTA-safe. A load error still lets the app boot in system type.
  const [fontsLoaded, fontError] = useFonts({
    [Fonts.display]: DelaGothicOne_400Regular,
    [Fonts.hud]: ChakraPetch_600SemiBold,
    [Fonts.hudBold]: ChakraPetch_700Bold,
    [Fonts.body]: Barlow_400Regular,
    [Fonts.bodyMedium]: Barlow_500Medium,
    [Fonts.bodySemi]: Barlow_600SemiBold,
  });

  return (
    <AuthProvider>
      <WorldProvider>
        <StatusBar style="light" backgroundColor={Colors.bg} />
        <RootLayoutNav fontsReady={fontsLoaded || !!fontError} />
        <CameoRoot />
        <ImpactFrame />
      </WorldProvider>
    </AuthProvider>
  );
}
