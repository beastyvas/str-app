import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
let AppleAuthentication: any = null; try { AppleAuthentication = require('expo-apple-authentication'); } catch {}
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

const IS_DEV = __DEV__;

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogle = async () => {
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

          <Text style={{ color: Colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>

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
    </SafeAreaView>
  );
}
