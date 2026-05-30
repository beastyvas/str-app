import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/colors';

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View className="flex-1 px-8 justify-between py-12">
        {/* Brand */}
        <View className="mt-16">
          <Text
            style={{ color: Colors.text, fontWeight: '900', fontSize: 72, letterSpacing: -4 }}
          >
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
        <View className="gap-4">
          <TouchableOpacity
            onPress={handleGoogle}
            disabled={loading}
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
        </View>
      </View>
    </SafeAreaView>
  );
}
