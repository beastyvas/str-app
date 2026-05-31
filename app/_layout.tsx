import '../global.css';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

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

function RootLayoutNav() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
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
  }, [session, profile, loading]);

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
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" backgroundColor="#0C0C0C" />
      <RootLayoutNav />
    </AuthProvider>
  );
}
