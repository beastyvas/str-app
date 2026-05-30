import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors, TierName } from '@/constants/colors';
import { TIER_LABELS } from '@/constants/strengthStandards';

const TIER_COLORS: Record<TierName, string> = {
  beginner: Colors.tiers.beginner,
  bronze: Colors.tiers.bronze,
  silver: Colors.tiers.silver,
  gold: Colors.tiers.gold,
  platinum: Colors.tiers.platinum,
  diamond: Colors.tiers.diamond,
};

export default function ProfileScreen() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bodyweight, setBodyweight] = useState(profile?.bodyweight_lbs?.toString() ?? '');
  const [unit, setUnit] = useState<'lbs' | 'kg'>(profile?.unit_pref ?? 'lbs');
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    const bw = parseFloat(bodyweight);
    if (!bw || bw < 50) { Alert.alert('Invalid bodyweight'); return; }
    setSaving(true);
    const bwLbs = unit === 'kg' ? bw * 2.205 : bw;
    const { error } = await supabase
      .from('users')
      .update({ display_name: displayName, bodyweight_lbs: Math.round(bwLbs * 10) / 10, unit_pref: unit })
      .eq('id', user!.id);
    if (error) Alert.alert('Error', error.message);
    else { await refreshProfile(); setEditing(false); }
    setSaving(false);
  };

  const bwDisplay = profile?.unit_pref === 'kg' && profile.bodyweight_lbs
    ? `${(profile.bodyweight_lbs / 2.205).toFixed(1)} kg`
    : `${profile?.bodyweight_lbs ?? '—'} lbs`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -1 }}>Profile</Text>
          <TouchableOpacity onPress={() => setEditing(!editing)}>
            <Text style={{ color: Colors.accent, fontWeight: '700', fontSize: 14 }}>
              {editing ? 'Cancel' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={{
          backgroundColor: Colors.surface,
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: Colors.border,
        }}>
          {editing ? (
            <View style={{ gap: 14 }}>
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                  Display Name
                </Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  style={{
                    backgroundColor: Colors.surface2,
                    borderColor: Colors.border,
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: Colors.text,
                    fontSize: 16,
                  }}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['lbs', 'kg'] as const).map(u => (
                  <TouchableOpacity
                    key={u}
                    onPress={() => setUnit(u)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      alignItems: 'center',
                      backgroundColor: unit === u ? Colors.accent : Colors.surface2,
                      borderWidth: 1,
                      borderColor: unit === u ? Colors.accent : Colors.border,
                    }}
                  >
                    <Text style={{ color: Colors.text, fontWeight: '700', textTransform: 'uppercase', fontSize: 13 }}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                  Bodyweight ({unit})
                </Text>
                <TextInput
                  value={bodyweight}
                  onChangeText={setBodyweight}
                  keyboardType="decimal-pad"
                  style={{
                    backgroundColor: Colors.surface2,
                    borderColor: Colors.border,
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: Colors.text,
                    fontSize: 22,
                    fontWeight: '700',
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={saveProfile}
                disabled={saving}
                style={{
                  backgroundColor: Colors.accent,
                  borderRadius: 10,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
              >
                {saving
                  ? <ActivityIndicator color={Colors.text} />
                  : <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 }}>SAVE</Text>
                }
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '800', marginBottom: 4 }}>
                {profile?.display_name ?? user?.email}
              </Text>
              <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>
                {bwDisplay} · {profile?.unit_pref?.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          onPress={signOut}
          style={{
            marginTop: 8,
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: Colors.danger,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: Colors.danger, fontWeight: '700', fontSize: 14 }}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
