import { useEffect, useState } from 'react';
import { View, TouchableOpacity, Alert, TextInput, Platform, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
let AppleAuthentication: any = null; try { AppleAuthentication = require('expo-apple-authentication'); } catch {}
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors, Fonts, Hit, Radius, Spacing, Type } from '@/constants/theme';
import { AppText, Button, IconSymbol } from '@/components/ui';
import { WORLDS, WorldScope } from '@/theme';
import { EulaModal } from '@/components/EulaModal';

const IS_DEV = __DEV__;

const WORLD = WORLDS.mortal;

/** A slow aura ring pulse behind the wordmark. Still under Reduce Motion. */
function AuraRing() {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduce) t.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce]);
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + t.value * 0.35, transform: [{ scale: 0.94 + t.value * 0.08 }] }));
  return <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: WORLD.aura }, style]} />;
}

// Login logic is identical to before; only the presentation changed.
export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // App Store Guideline 1.2 — the user must accept the Terms of Use (EULA)
  // BEFORE an account is created. All sign-in paths are gated on this.
  const [agreed, setAgreed] = useState(false);
  const [showEula, setShowEula] = useState(false);

  // Returns true if the user has agreed; otherwise nudges them and blocks.
  const requireAgreement = (): boolean => {
    if (agreed) return true;
    Alert.alert('Agree to continue', 'Please accept the Terms of Use to create your account.');
    return false;
  };

  const acceptEula = () => {
    setAgreed(true);
    setShowEula(false);
    AsyncStorage.setItem('eula_accepted', 'true').catch(() => {});
  };

  const handleGoogle = async () => {
    if (!requireAgreement()) return;
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (e: any) {
      Alert.alert('Sign in failed', e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    if (!requireAgreement()) return;
    try {
      setAppleLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token from Apple');
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return; // user dismissed
      Alert.alert('Apple sign in failed', e?.message ?? 'Something went wrong.');
    } finally {
      setAppleLoading(false);
    }
  };

  const handleDevLogin = async () => {
    if (!requireAgreement()) return;
    if (!email || !password) { Alert.alert('Enter email and password'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
      }
    } catch (e: any) {
      Alert.alert('Dev login failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <WorldScope world={WORLD}>
      <SafeAreaView style={styles.root}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none"><WORLD.Motif intensity="full" /></View>
        <View style={styles.content}>
          <View style={styles.brand}>
            <AuraRing />
            <AppText style={styles.wordmark} allowFontScaling={false}>STR</AppText>
            <AppText variant="label">Strength, measured.</AppText>
          </View>

          <AppText variant="title" style={styles.tagline}>Log the work.{'\n'}Find your Power Level.{'\n'}Climb the worlds.</AppText>

          <View style={styles.auth}>
            {/* Sign in with Apple — iOS only */}
            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={Radius.lg}
                style={styles.apple}
                onPress={handleApple}
              />
            )}
            <Button
              label="Continue with Google"
              variant="secondary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={loading || appleLoading}
              onPress={handleGoogle}
            />

            {/* EULA acceptance — required before account creation (Guideline 1.2) */}
            <TouchableOpacity onPress={() => setAgreed(a => !a)} activeOpacity={0.7} style={styles.eula} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
              <View style={[styles.box, agreed && { backgroundColor: WORLD.aura, borderColor: WORLD.aura }]}>
                {agreed && <IconSymbol name="check" size={14} color={Colors.bg} />}
              </View>
              <AppText variant="caption" style={styles.flex}>
                I agree to the{' '}
                <AppText variant="caption" color={WORLD.aura} onPress={() => setShowEula(true)}>Terms of Use (EULA)</AppText>
                {' '}and Privacy Policy. STR has zero tolerance for objectionable content and abusive users.
              </AppText>
            </TouchableOpacity>

            {/* Dev-only email login */}
            {IS_DEV && (
              <View style={styles.dev}>
                <TouchableOpacity onPress={() => setShowDev(!showDev)} style={styles.devToggle}>
                  <AppText variant="caption">{showDev ? 'Hide dev login' : 'Dev login'}</AppText>
                </TouchableOpacity>
                {showDev && (
                  <>
                    <TextInput value={email} onChangeText={setEmail} placeholder="email" placeholderTextColor={Colors.textMuted}
                      keyboardType="email-address" autoCapitalize="none" style={styles.input} />
                    <TextInput value={password} onChangeText={setPassword} placeholder="password" placeholderTextColor={Colors.textMuted}
                      secureTextEntry style={styles.input} />
                    <Button label="Sign in or sign up with email" variant="tinted" fullWidth onPress={handleDevLogin} disabled={loading} />
                  </>
                )}
              </View>
            )}
          </View>
        </View>

        <EulaModal visible={showEula} onClose={() => setShowEula(false)} onAgree={acceptEula} />
      </SafeAreaView>
    </WorldScope>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { flex: 1, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.xxl, justifyContent: 'space-between' },
  brand: { marginTop: Spacing.xxl * 2, alignItems: 'flex-start', gap: Spacing.xs },
  ring: { position: 'absolute', left: -40, top: -46, width: 200, height: 200, borderRadius: 100, borderWidth: 1.5 },
  wordmark: { fontFamily: Fonts.display, fontSize: 80, lineHeight: 92, color: Colors.text },
  tagline: { color: Colors.textSecondary },
  auth: { gap: Spacing.md },
  apple: { width: '100%', height: Hit.log },
  eula: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.sm },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  dev: { marginTop: Spacing.lg, gap: Spacing.sm },
  devToggle: { alignItems: 'center', minHeight: Hit.min, justifyContent: 'center' },
  input: {
    backgroundColor: Colors.surface2, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, minHeight: 48,
    color: Colors.text, fontFamily: Type.body.fontFamily, fontSize: 15, borderWidth: 1, borderColor: Colors.border,
  },
});
