import { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

export default function OnboardingScreen() {
  const { user, refreshProfile } = useAuth();
  const [bodyweight, setBodyweight] = useState('');
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const bw = parseFloat(bodyweight);
    if (!bw || bw < 50 || bw > 1000) {
      Alert.alert('Check your weight', 'Enter a realistic bodyweight.');
      return;
    }

    setSaving(true);
    try {
      const bwLbs = unit === 'kg' ? bw * 2.205 : bw;
      const { error } = await supabase
        .from('users')
        .update({ bodyweight_lbs: Math.round(bwLbs * 10) / 10, unit_pref: unit })
        .eq('id', user!.id);

      if (error) throw error;
      await refreshProfile();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View className="flex-1 px-8 justify-center gap-10">
          <View>
            <Text style={{ color: Colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -1 }}>
              One quick thing.
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 15, marginTop: 8, lineHeight: 22 }}>
              Your bodyweight powers the strength standard tiers. You can update it anytime.
            </Text>
          </View>

          {/* Unit toggle */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['lbs', 'kg'] as const).map((u) => (
              <TouchableOpacity
                key={u}
                onPress={() => setUnit(u)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: unit === u ? Colors.accent : Colors.surface2,
                  borderWidth: 1,
                  borderColor: unit === u ? Colors.accent : Colors.border,
                }}
              >
                <Text style={{
                  color: Colors.text,
                  fontWeight: '700',
                  fontSize: 15,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}>
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bodyweight input */}
          <View>
            <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>
              Bodyweight ({unit})
            </Text>
            <TextInput
              value={bodyweight}
              onChangeText={setBodyweight}
              keyboardType="decimal-pad"
              placeholder={unit === 'lbs' ? '185' : '84'}
              placeholderTextColor={Colors.textMuted}
              style={{
                backgroundColor: Colors.surface,
                borderColor: Colors.border,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 20,
                paddingVertical: 18,
                color: Colors.text,
                fontSize: 32,
                fontWeight: '700',
                letterSpacing: -1,
              }}
            />
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !bodyweight}
            style={{
              backgroundColor: saving || !bodyweight ? Colors.surface2 : Colors.accent,
              borderRadius: 12,
              paddingVertical: 18,
              alignItems: 'center',
            }}
          >
            {saving
              ? <ActivityIndicator color={Colors.text} />
              : <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>
                  LET'S GO
                </Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
