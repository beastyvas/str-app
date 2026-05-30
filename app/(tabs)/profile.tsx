import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors, TierName } from '@/constants/colors';
import { getTierForWeight, TIER_LABELS, TIER_ORDER } from '@/constants/strengthStandards';

const TIER_COLORS: Record<TierName, string> = {
  beginner: Colors.tiers.beginner,
  bronze: Colors.tiers.bronze,
  silver: Colors.tiers.silver,
  gold: Colors.tiers.gold,
  platinum: Colors.tiers.platinum,
  diamond: Colors.tiers.diamond,
};

interface LiftTier {
  exerciseName: string;
  weight: number;
  reps: number;
  tier: TierName;
}

interface Stats {
  totalWorkouts: number;
  totalVolume: number;
  liftTiers: LiftTier[];
}

export default function ProfileScreen() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bodyweight, setBodyweight] = useState(profile?.bodyweight_lbs?.toString() ?? '');
  const [unit, setUnit] = useState<'lbs' | 'kg'>(profile?.unit_pref ?? 'lbs');
  const [saving, setSaving] = useState(false);

  // Lifter DNA
  const [dnaModalOpen, setDnaModalOpen] = useState(false);
  const [dnaText, setDnaText] = useState(profile?.training_notes ?? '');
  const [dnaSaving, setDnaSaving] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (user) loadStats();
  }, [user, profile?.bodyweight_lbs]);

  const loadStats = async () => {
    if (!user) return;
    setLoadingStats(true);
    try {
      const [{ data: workouts }, { data: prs }] = await Promise.all([
        supabase
          .from('workouts')
          .select('id, workout_sets(weight, reps)')
          .eq('user_id', user.id)
          .not('ended_at', 'is', null),
        supabase
          .from('personal_records')
          .select('weight, reps, exercises(name)')
          .eq('user_id', user.id),
      ]);

      const totalWorkouts = workouts?.length ?? 0;
      const totalVolume = workouts?.reduce((sum, w) => {
        const sets = (w.workout_sets as any[]) ?? [];
        return sum + sets.reduce((s: number, set: any) => s + set.weight * set.reps, 0);
      }, 0) ?? 0;

      const bw = profile?.bodyweight_lbs ?? 185;
      const liftTiers: LiftTier[] = (prs ?? [])
        .map((pr: any) => ({
          exerciseName: pr.exercises?.name ?? '',
          weight: pr.weight,
          reps: pr.reps,
          tier: getTierForWeight(pr.exercises?.name ?? '', pr.weight, bw),
        }))
        .filter(lt => lt.exerciseName && lt.tier !== 'beginner')
        .sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier));

      setStats({ totalWorkouts, totalVolume, liftTiers });
    } catch (e) {
      // silent
    } finally {
      setLoadingStats(false);
    }
  };

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

  const saveDNA = async () => {
    if (!user) return;
    setDnaSaving(true);
    const { error } = await supabase
      .from('users')
      .update({ training_notes: dnaText.trim() || null })
      .eq('id', user.id);
    if (error) Alert.alert('Error', error.message);
    else { await refreshProfile(); setDnaModalOpen(false); }
    setDnaSaving(false);
  };

  const bwDisplay = profile?.unit_pref === 'kg' && profile.bodyweight_lbs
    ? `${(profile.bodyweight_lbs / 2.205).toFixed(1)} kg`
    : `${profile?.bodyweight_lbs ?? '—'} lbs`;

  const formatVolume = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return v.toLocaleString();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -1 }}>Profile</Text>
          <TouchableOpacity onPress={() => {
            setDisplayName(profile?.display_name ?? '');
            setBodyweight(profile?.bodyweight_lbs?.toString() ?? '');
            setUnit(profile?.unit_pref ?? 'lbs');
            setEditing(!editing);
          }}>
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
          marginBottom: 16,
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
                style={{ backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}
              >
                {saving
                  ? <ActivityIndicator color={Colors.text} />
                  : <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 }}>SAVE</Text>
                }
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={{ color: Colors.text, fontSize: 24, fontWeight: '800', marginBottom: 4 }}>
                {profile?.display_name ?? user?.email}
              </Text>
              <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>
                {bwDisplay} · {profile?.unit_pref?.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        {!loadingStats && stats && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Workouts', value: stats.totalWorkouts.toString() },
              { label: 'Total Volume', value: `${formatVolume(stats.totalVolume)} lbs` },
            ].map((s, i) => (
              <View key={i} style={{
                flex: 1,
                backgroundColor: Colors.surface,
                borderRadius: 14,
                padding: 16,
                borderWidth: 1,
                borderColor: Colors.border,
                alignItems: 'center',
              }}>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                  {s.label}
                </Text>
                <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -1 }}>{s.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Strength Tiers */}
        {!loadingStats && stats && stats.liftTiers.length > 0 && (
          <View style={{
            backgroundColor: Colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: Colors.border,
          }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
              Strength Tiers
            </Text>
            {stats.liftTiers.map((lt, i) => (
              <View key={i} style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                borderBottomWidth: i < stats.liftTiers.length - 1 ? 1 : 0,
                borderBottomColor: Colors.border,
              }}>
                <View style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: TIER_COLORS[lt.tier],
                  marginRight: 10,
                }} />
                <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '600', flex: 1 }}>
                  {lt.exerciseName}
                </Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 12, marginRight: 10 }}>
                  {lt.weight} × {lt.reps}
                </Text>
                <View style={{
                  backgroundColor: TIER_COLORS[lt.tier] + '20',
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}>
                  <Text style={{ color: TIER_COLORS[lt.tier], fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
                    {TIER_LABELS[lt.tier].toUpperCase()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {loadingStats && (
          <ActivityIndicator color={Colors.textMuted} style={{ marginVertical: 20 }} />
        )}

        {/* Lifter DNA */}
        <TouchableOpacity
          onPress={() => { setDnaText(profile?.training_notes ?? ''); setDnaModalOpen(true); }}
          style={{
            backgroundColor: Colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: profile?.training_notes ? Colors.accent + '50' : Colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800' }}>
              Lifter DNA
            </Text>
            <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700' }}>
              {profile?.training_notes ? 'Edit' : 'Add →'}
            </Text>
          </View>
          <Text style={{ color: Colors.textMuted, fontSize: 12, lineHeight: 18 }}>
            {profile?.training_notes
              ? profile.training_notes.slice(0, 120) + (profile.training_notes.length > 120 ? '…' : '')
              : 'Paste your lifting history, injuries, weaknesses, goals. Coach reads this before every response.'}
          </Text>
        </TouchableOpacity>

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

      {/* Lifter DNA Modal */}
      <Modal visible={dnaModalOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: 20, paddingVertical: 16,
              borderBottomWidth: 1, borderBottomColor: Colors.border,
            }}>
              <View>
                <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '900' }}>Lifter DNA</Text>
                <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  Coach reads this before every response
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDnaModalOpen(false)}>
                <Text style={{ color: Colors.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              <View style={{ padding: 20, gap: 16 }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
                  Dump everything here. Training history, injury history, what works for you, what doesn't,
                  your weak points, your goals, your lifestyle (sleep, diet, stress). The more detail, the
                  more personalized Coach's responses get.
                </Text>

                <View style={{
                  backgroundColor: Colors.surface,
                  borderRadius: 10,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 6, fontWeight: '700' }}>
                    EXAMPLE
                  </Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 12, lineHeight: 18 }}>
                    "Training 3 years, mostly bodybuilding. Left shoulder impingement from overtraining bench — flat pressing bothers me at the bottom. Bench has always been my weakest SBD, probably 40 lbs behind where it should be for my squat and deadlift. I do better with high reps on isolation work. Goal is to compete in a local powerlifting meet within 2 years..."
                  </Text>
                </View>

                <TextInput
                  value={dnaText}
                  onChangeText={setDnaText}
                  multiline
                  autoFocus
                  placeholder="Start writing..."
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    backgroundColor: Colors.surface,
                    borderRadius: 14,
                    padding: 16,
                    color: Colors.text,
                    fontSize: 14,
                    minHeight: 200,
                    textAlignVertical: 'top',
                    borderWidth: 1,
                    borderColor: Colors.border,
                    lineHeight: 22,
                  }}
                />

                <TouchableOpacity
                  onPress={saveDNA}
                  disabled={dnaSaving}
                  style={{
                    backgroundColor: Colors.accent,
                    borderRadius: 12,
                    paddingVertical: 16,
                    alignItems: 'center',
                  }}
                >
                  {dnaSaving
                    ? <ActivityIndicator color={Colors.text} />
                    : <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 15 }}>SAVE</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
