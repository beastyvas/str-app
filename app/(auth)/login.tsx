import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

const IS_DEV = __DEV__;

export default function LoginScreen() {
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  const handleApple = async () => {
    try {
      setLoading(true);
      await signInWithApple();
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign in failed', e?.message ?? 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

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

  const handleDevLogin = async () => {
    if (!email || !password) { Alert.alert('Enter email and password'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // Try sign up if login fails
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
        <View style={{ marginTop: 64 }}>
          <Text
            style={{ color: Colors.text, fontWeight: '900', fontSize: 72, letterSpacing: -4 }}
          >
            STR
          </Text>
          <View style={{ width: 48, height: 3, backgroundColor: Colors.accent, borderRadius: 2, marginTop: 2, marginBottom: 8 }} />
          <Text style={{ color: Colors.textMuted, fontSize: 12, letterSpacing: 3, fontWeight: '600' }}>
            STRENGTH TRACKER
          </Text>
        </View>

        {/* Tagline */}
        <View style={{ gap: 2 }}>
          {['Log the work.', 'Know your numbers.', 'Get stronger.'].map((line, i) => (
            <Text key={i} style={{
              color: i === 2 ? Colors.text : Colors.textSecondary,
              fontSize: i === 2 ? 22 : 20,
              fontWeight: i === 2 ? '700' : '300',
              lineHeight: 32,
            }}>
              {line}
            </Text>
          ))}
        </View>

        {/* Auth */}
        <View className="gap-4">
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={14}
              style={{ width: '100%', height: 54 }}
              onPress={handleApple}
            />
          )}

          <TouchableOpacity
            onPress={handleGoogle}
            disabled={loading}
            style={{
              backgroundColor: Colors.surface,
              borderColor: Colors.borderLight,
              borderWidth: 1,
              borderRadius: 14,
              paddingVertical: 17,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 10,
              shadowColor: '#000',
              shadowOpacity: 0.3,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 4,
            }}
          >
            {loading ? (
              <ActivityIndicator color={Colors.text} />
            ) : (
              <>
                <View style={{
                  width: 22, height: 22, borderRadius: 4,
                  backgroundColor: Colors.surface2,
                  borderWidth: 1, borderColor: Colors.borderLight,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 13, color: Colors.text, fontWeight: '900' }}>G</Text>
                </View>
                <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 15 }}>
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={{ color: Colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>

          {/* Dev-only email login — hidden in production */}
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
