import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
let AppleAuthentication: any = null; try { AppleAuthentication = require('expo-apple-authentication'); } catch {}
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { EulaModal } from '@/components/EulaModal';

const IS_DEV = __DEV__;

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
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View className="flex-1 px-8 justify-between py-12">
        {/* Brand */}
        <View className="mt-16">
          <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 72, letterSpacing: -4 }}>
            STR
          </Text>
          <Text style={{ color: Colors.textMuted, fontSize: 14, marginTop: 4, letterSpacing: 2 }}>
            STRENGTH TRACKER
          </Text>
        </View>

        {/* Tagline */}
        <View>
          <Text style={{ color: Colors.textSecondary, fontSize: 20, fontWeight: '300', lineHeight: 28 }}>
            Log the work.{'\n'}
            Know your numbers.{'\n'}
            Get stronger.
          </Text>
        </View>

        {/* Auth */}
        <View style={{ gap: 12 }}>
          {/* Sign in with Apple — iOS only, required by App Store */}
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={12}
              style={{ width: '100%', height: 52 }}
              onPress={handleApple}
            />
          )}

          {/* Continue with Google */}
          <TouchableOpacity
            onPress={handleGoogle}
            disabled={loading || appleLoading}
            style={{
              backgroundColor: Colors.surface2,
              borderColor: Colors.border,
              borderWidth: 1,
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            {loading ? (
              <ActivityIndicator color={Colors.text} />
            ) : (
              <>
                <Text style={{ fontSize: 16, color: Colors.text }}>G</Text>
                <Text style={{ color: Colors.text, fontWeight: '600', fontSize: 15 }}>
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* EULA acceptance — required before account creation (Guideline 1.2) */}
          <TouchableOpacity
            onPress={() => setAgreed(a => !a)}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 4 }}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 6, marginTop: 1,
              borderWidth: 1.5,
              borderColor: agreed ? Colors.accent : Colors.border,
              backgroundColor: agreed ? Colors.accent : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {agreed && <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '900' }}>✓</Text>}
            </View>
            <Text style={{ color: Colors.textMuted, fontSize: 12, flex: 1, lineHeight: 17 }}>
              I agree to the{' '}
              <Text
                style={{ color: Colors.accent, fontWeight: '700' }}
                onPress={() => setShowEula(true)}
              >
                Terms of Use (EULA)
              </Text>
              {' '}and Privacy Policy. I understand STR has zero tolerance for objectionable
              content and abusive users.
            </Text>
          </TouchableOpacity>

          {/* Dev-only email login */}
          {IS_DEV && (
            <View style={{ marginTop: 24, gap: 8 }}>
              <TouchableOpacity onPress={() => setShowDev(!showDev)} style={{ alignItems: 'center' }}>
                <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                  {showDev ? '— hide dev login —' : '⚙ dev login'}
                </Text>
              </TouchableOpacity>
              {showDev && (
                <View style={{ gap: 8 }}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="email"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={{
                      backgroundColor: Colors.surface2, borderRadius: 10,
                      paddingHorizontal: 14, paddingVertical: 12,
                      color: Colors.text, fontSize: 14,
                      borderWidth: 1, borderColor: Colors.border,
                    }}
                  />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="password"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry
                    style={{
                      backgroundColor: Colors.surface2, borderRadius: 10,
                      paddingHorizontal: 14, paddingVertical: 12,
                      color: Colors.text, fontSize: 14,
                      borderWidth: 1, borderColor: Colors.border,
                    }}
                  />
                  <TouchableOpacity
                    onPress={handleDevLogin}
                    disabled={loading}
                    style={{
                      backgroundColor: Colors.surface2, borderRadius: 10,
                      paddingVertical: 12, alignItems: 'center',
                      borderWidth: 1, borderColor: Colors.accent + '40',
                    }}
                  >
                    <Text style={{ color: Colors.accent, fontWeight: '700', fontSize: 13 }}>
                      Sign in / Sign up with email
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      <EulaModal visible={showEula} onClose={() => setShowEula(false)} onAgree={acceptEula} />
    </SafeAreaView>
  );
}
