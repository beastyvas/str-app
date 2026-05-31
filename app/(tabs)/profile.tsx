import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors, TierName } from '@/constants/colors';
import { getTierForWeight, TIER_LABELS, TIER_ORDER, STRENGTH_STANDARDS } from '@/constants/strengthStandards';
import { getAnimeTierResult } from '@/constants/animeTiers';

const TIER_COLORS: Record<TierName, string> = {
  beginner: Colors.tiers.beginner,
  bronze: Colors.tiers.bronze,
  silver: Colors.tiers.silver,
  gold: Colors.tiers.gold,
  platinum: Colors.tiers.platinum,
  diamond: Colors.tiers.diamond,
};

interface PREntry {
  exerciseName: string;
  weight: number;
  reps: number;
  tier: TierName;
}

interface MuscleGroupTier {
  group: string;
  tier: TierName;
  bestLift: string;
  weight: number;
}

interface ProfileStats {
  totalWorkouts: number;
  totalVolume: number;
  totalSets: number;
  prsHit: number;
  streakDays: number;
  allPRs: PREntry[];
  muscleGroupTiers: MuscleGroupTier[];
}

export default function ProfileScreen() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bodyweight, setBodyweight] = useState(profile?.bodyweight_lbs?.toString() ?? '');
  const [unit, setUnit] = useState<'lbs' | 'kg'>(profile?.unit_pref ?? 'lbs');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [animeTier, setAnimeTier] = useState<ReturnType<typeof getAnimeTierResult> | null>(null);

  // Lifter DNA
  const [dnaModalOpen, setDnaModalOpen] = useState(false);
  const [dnaText, setDnaText] = useState(profile?.training_notes ?? '');
  const [dnaSaving, setDnaSaving] = useState(false);

  useEffect(() => {
    if (user) loadStats();
  }, [user, profile?.bodyweight_lbs]);

  const loadStats = async () => {
    if (!user) return;
    setLoadingStats(true);
    try {
      const [{ data: workouts }, { data: prs }, { data: allWorkoutSets }] = await Promise.all([
        supabase.from('workouts').select('id, started_at').eq('user_id', user.id).not('ended_at', 'is', null),
        supabase.from('personal_records').select('weight, reps, achieved_at, exercises(name)').eq('user_id', user.id).order('achieved_at', { ascending: false }),
        supabase.from('workout_sets').select('weight, reps, workout_id').eq('workouts.user_id', user.id),
      ]);

      // Streak calculation
      const daySet = new Set((workouts ?? []).map(w => new Date(w.started_at).toDateString()));
      let streak = 0;
      for (let d = 0; d < 90; d++) {
        const day = new Date();
        day.setDate(day.getDate() - d);
        if (daySet.has(day.toDateString())) streak++;
        else if (d > 0) break;
      }

      // Total volume from all PRs (approximate)
      const bw = profile?.bodyweight_lbs ?? 185;
      const allPRs: PREntry[] = (prs ?? []).map((p: any) => ({
        exerciseName: p.exercises?.name ?? '',
        weight: p.weight,
        reps: p.reps,
        tier: getTierForWeight(p.exercises?.name ?? '', p.weight, bw),
      })).filter(p => p.exerciseName);

      // SBD for anime tier
      const sbdPRs = allPRs
        .filter(p => ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts'].includes(p.exerciseName))
        .map(p => ({ exerciseName: p.exerciseName, weight: p.weight, reps: p.reps }));
      setAnimeTier(getAnimeTierResult(sbdPRs, bw));

      // Volume from sets
      const { data: volumeData } = await supabase
        .from('workout_sets')
        .select('weight, reps, workouts!inner(user_id)')
        .eq('workouts.user_id', user.id);

      const totalVolume = (volumeData ?? []).reduce((s: number, x: any) => s + x.weight * x.reps, 0);
      const totalSets = (volumeData ?? []).length;

      // Per muscle group — best tier from all PRs in that group
      const groupMap: Record<string, { tier: TierName; bestLift: string; weight: number }> = {};
      for (const pr of allPRs) {
        // Get muscle group from the exercise name via standards
        const standard = STRENGTH_STANDARDS[pr.exerciseName.toLowerCase()];
        if (!standard || pr.tier === 'beginner') continue;
        // Find muscle group tag from prs data
        const prRow = (prs ?? []).find((p: any) => p.exercises?.name === pr.exerciseName) as any;
        const mg = prRow?.exercises?.muscle_group ?? 'Overall';
        if (!groupMap[mg] || TIER_ORDER.indexOf(pr.tier) > TIER_ORDER.indexOf(groupMap[mg].tier)) {
          groupMap[mg] = { tier: pr.tier, bestLift: pr.exerciseName, weight: pr.weight };
        }
      }
      const muscleGroupTiers: MuscleGroupTier[] = Object.entries(groupMap)
        .sort((a, b) => TIER_ORDER.indexOf(b[1].tier) - TIER_ORDER.indexOf(a[1].tier))
        .map(([group, data]) => ({ group, ...data }));

      setStats({
        totalWorkouts: workouts?.length ?? 0,
        totalVolume,
        totalSets,
        prsHit: prs?.length ?? 0,
        streakDays: streak,
        allPRs,
        muscleGroupTiers,
      });
    } catch (e) {
      // silence
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
      .update({ display_name: displayName.trim(), bodyweight_lbs: Math.round(bwLbs * 10) / 10, unit_pref: unit })
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

  const formatVolume = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
    return String(v);
  };

  const bwDisplay = profile?.unit_pref === 'kg' && profile.bodyweight_lbs
    ? `${(profile.bodyweight_lbs / 2.205).toFixed(1)} kg`
    : `${profile?.bodyweight_lbs ?? '—'} lbs`;

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const tierColor = animeTier?.animeTier.color ?? Colors.accent;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <View style={{
          alignItems: 'center',
          paddingTop: 28,
          paddingBottom: 24,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
        }}>
          {/* Avatar */}
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: tierColor + '20',
            borderWidth: 2.5,
            borderColor: tierColor + '80',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}>
            <Text style={{ color: tierColor, fontWeight: '900', fontSize: 28 }}>
              {initials(profile?.display_name ?? user?.email ?? '?')}
            </Text>
          </View>

          {/* Name + bodyweight */}
          <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 }}>
            {profile?.display_name ?? user?.email}
          </Text>
          <Text style={{ color: Colors.textMuted, fontSize: 13, marginBottom: 12 }}>
            {bwDisplay}
          </Text>

          {/* Anime tier badge */}
          {animeTier && stats?.allPRs.some(p => ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts'].includes(p.exerciseName)) && (
            <View style={{
              backgroundColor: tierColor + '18',
              borderRadius: 8,
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: tierColor + '40',
              marginBottom: 12,
            }}>
              <Text style={{ color: tierColor, fontWeight: '900', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
                {animeTier.animeTier.label}
              </Text>
            </View>
          )}

          {/* Edit button */}
          <TouchableOpacity
            onPress={() => {
              setDisplayName(profile?.display_name ?? '');
              setBodyweight(profile?.bodyweight_lbs?.toString() ?? '');
              setUnit(profile?.unit_pref ?? 'lbs');
              setEditing(true);
            }}
            style={{
              paddingHorizontal: 20, paddingVertical: 8,
              borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
            }}
          >
            <Text style={{ color: Colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={{ padding: 20, gap: 16 }}>

          {/* ── STATS ───────────────────────────────────────────────────────── */}
          {!loadingStats && stats && animeTier && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                { label: 'Rank', value: animeTier.animeTier.label, color: animeTier.animeTier.color },
                { label: 'Volume', value: `${formatVolume(stats.totalVolume)} lbs`, color: null },
                { label: 'PRs', value: String(stats.prsHit), color: null },
                { label: 'Streak', value: `${stats.streakDays}d`, color: null },
              ].map((s, i) => (
                <View key={i} style={{
                  flex: 1, minWidth: '40%',
                  backgroundColor: Colors.surface, borderRadius: 12,
                  padding: 12, alignItems: 'center',
                  borderWidth: 1,
                  borderColor: i === 0 ? (s.color + '40') : Colors.border,
                }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
                    {s.label}
                  </Text>
                  <Text style={{ color: s.color ?? Colors.text, fontSize: i === 0 ? 14 : 18, fontWeight: '900', letterSpacing: -0.5 }}>
                    {s.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* ── SBD TIERS ───────────────────────────────────────────────────── */}
          {animeTier && animeTier.lifts.some(l => l.weight > 0) && (
            <View style={{
              backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
              borderWidth: 1, borderColor: Colors.border,
            }}>
              <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
                SBD Strength
              </Text>
              {animeTier.lifts.map((lift, i) => {
                const pct = Math.min(lift.tierScore / 5, 1);
                const hasData = lift.weight > 0;
                return (
                  <View key={i} style={{ marginBottom: i < 2 ? 12 : 0 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '800', width: 24 }}>{lift.label}</Text>
                        {hasData && <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>{lift.weight} lbs</Text>}
                      </View>
                      {hasData ? (
                        <View style={{
                          backgroundColor: TIER_COLORS[lift.tier] + '20',
                          borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2,
                        }}>
                          <Text style={{ color: TIER_COLORS[lift.tier], fontSize: 10, fontWeight: '800' }}>
                            {TIER_LABELS[lift.tier].toUpperCase()}
                          </Text>
                        </View>
                      ) : (
                        <Text style={{ color: Colors.textMuted, fontSize: 11 }}>not logged</Text>
                      )}
                    </View>
                    <View style={{ height: 5, backgroundColor: Colors.surface2, borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{
                        height: '100%',
                        width: `${(hasData ? pct : 0.02) * 100}%`,
                        backgroundColor: hasData ? TIER_COLORS[lift.tier] : Colors.border,
                        borderRadius: 3,
                      }} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── BODY PART TIERS ─────────────────────────────────────────────── */}
          {stats && stats.muscleGroupTiers.length > 0 && (
            <View style={{
              backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
              borderWidth: 1, borderColor: Colors.border,
            }}>
              <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
                Body Part Ranks
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {stats.muscleGroupTiers.map((mg, i) => {
                  const tierColor = TIER_COLORS[mg.tier];
                  return (
                    <View key={i} style={{
                      width: '47%',
                      backgroundColor: tierColor + '10',
                      borderRadius: 12,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: tierColor + '40',
                      gap: 4,
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: Colors.textSecondary, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>
                          {mg.group}
                        </Text>
                        <View style={{
                          backgroundColor: tierColor + '25',
                          borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
                        }}>
                          <Text style={{ color: tierColor, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>
                            {TIER_LABELS[mg.tier].toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: Colors.textMuted, fontSize: 10 }} numberOfLines={1}>
                        {mg.bestLift}
                      </Text>
                      <Text style={{ color: tierColor, fontSize: 13, fontWeight: '800' }}>
                        {mg.weight} lbs
                      </Text>
                      {/* Mini tier bar */}
                      <View style={{ height: 3, backgroundColor: Colors.surface2, borderRadius: 2, marginTop: 4 }}>
                        <View style={{
                          height: '100%',
                          width: `${(TIER_ORDER.indexOf(mg.tier) / 5) * 100}%`,
                          backgroundColor: tierColor,
                          borderRadius: 2,
                        }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── ALL EXERCISE PRs ─────────────────────────────────────────────── */}
          {stats && stats.allPRs.length > 0 && (
            <View style={{
              backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
              borderWidth: 1, borderColor: Colors.border,
            }}>
              <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
                All Lift PRs
              </Text>
              {stats.allPRs.map((pr, i) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: i < stats.allPRs.length - 1 ? 1 : 0,
                  borderBottomColor: Colors.border,
                  gap: 10,
                }}>
                  <View style={{
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: TIER_COLORS[pr.tier],
                    flexShrink: 0,
                  }} />
                  <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                    {pr.exerciseName}
                  </Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
                    {pr.weight === 0 ? `BW×${pr.reps}` : `${pr.weight}×${pr.reps}`}
                  </Text>
                  <View style={{
                    backgroundColor: TIER_COLORS[pr.tier] + '18',
                    borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2,
                  }}>
                    <Text style={{ color: TIER_COLORS[pr.tier], fontSize: 9, fontWeight: '800' }}>
                      {TIER_LABELS[pr.tier].toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {loadingStats && <ActivityIndicator color={Colors.textMuted} />}

          {/* ── LIFTER DNA ───────────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => { setDnaText(profile?.training_notes ?? ''); setDnaModalOpen(true); }}
            style={{
              backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
              borderWidth: 1,
              borderColor: profile?.training_notes ? Colors.accent + '50' : Colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800' }}>Lifter DNA</Text>
              <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700' }}>
                {profile?.training_notes ? 'Edit' : 'Add →'}
              </Text>
            </View>
            <Text style={{ color: Colors.textMuted, fontSize: 12, lineHeight: 18 }}>
              {profile?.training_notes
                ? profile.training_notes.slice(0, 120) + (profile.training_notes.length > 120 ? '…' : '')
                : 'Injuries, goals, what works. Coach reads this before every response.'}
            </Text>
          </TouchableOpacity>

          {/* ── SIGN OUT ─────────────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={signOut}
            style={{
              paddingVertical: 14, borderRadius: 12,
              borderWidth: 1, borderColor: Colors.danger, alignItems: 'center',
            }}
          >
            <Text style={{ color: Colors.danger, fontWeight: '700', fontSize: 14 }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── EDIT MODAL ──────────────────────────────────────────────────────── */}
      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: 20, paddingVertical: 16,
              borderBottomWidth: 1, borderBottomColor: Colors.border,
            }}>
              <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '900' }}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <Text style={{ color: Colors.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
                  Display Name
                </Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  style={{
                    backgroundColor: Colors.surface, borderColor: Colors.border,
                    borderWidth: 1, borderRadius: 12,
                    paddingHorizontal: 16, paddingVertical: 14,
                    color: Colors.text, fontSize: 16,
                  }}
                />
              </View>

              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
                  Unit
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['lbs', 'kg'] as const).map(u => (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setUnit(u)}
                      style={{
                        flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
                        backgroundColor: unit === u ? Colors.accent : Colors.surface,
                        borderWidth: 1, borderColor: unit === u ? Colors.accent : Colors.border,
                      }}
                    >
                      <Text style={{ color: Colors.text, fontWeight: '700', textTransform: 'uppercase', fontSize: 14 }}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
                  Bodyweight ({unit})
                </Text>
                <TextInput
                  value={bodyweight}
                  onChangeText={setBodyweight}
                  keyboardType="decimal-pad"
                  style={{
                    backgroundColor: Colors.surface, borderColor: Colors.border,
                    borderWidth: 1, borderRadius: 12,
                    paddingHorizontal: 16, paddingVertical: 14,
                    color: Colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -1,
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={saveProfile}
                disabled={saving}
                style={{
                  backgroundColor: Colors.accent, borderRadius: 12,
                  paddingVertical: 16, alignItems: 'center', marginTop: 8,
                }}
              >
                {saving
                  ? <ActivityIndicator color={Colors.text} />
                  : <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 16 }}>Save</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── LIFTER DNA MODAL ─────────────────────────────────────────────────── */}
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
                <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>Coach reads this before every response</Text>
              </View>
              <TouchableOpacity onPress={() => setDnaModalOpen(false)}>
                <Text style={{ color: Colors.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
              <Text style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
                Training history, injuries, what works for you, weak points, goals, lifestyle. The more detail, the more personalized Coach gets.
              </Text>
              <TextInput
                value={dnaText}
                onChangeText={setDnaText}
                multiline
                autoFocus
                placeholder="Start writing..."
                placeholderTextColor={Colors.textMuted}
                style={{
                  backgroundColor: Colors.surface, borderRadius: 14,
                  padding: 16, color: Colors.text, fontSize: 14,
                  minHeight: 220, textAlignVertical: 'top',
                  borderWidth: 1, borderColor: Colors.border, lineHeight: 22,
                }}
              />
              <TouchableOpacity
                onPress={saveDNA}
                disabled={dnaSaving}
                style={{ backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
              >
                {dnaSaving ? <ActivityIndicator color={Colors.text} /> : <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 15 }}>Save</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
