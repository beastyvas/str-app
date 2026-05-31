import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors, TierName } from '@/constants/colors';
import { TIER_ORDER } from '@/constants/strengthStandards';
import { getAnimeTierResult, getNextTierGap, AnimeTierResult, SBD_EXERCISES, ROMAN } from '@/constants/animeTiers';

const TIER_COLORS: Record<TierName, string> = {
  beginner: Colors.tiers.beginner,
  bronze: Colors.tiers.bronze,
  silver: Colors.tiers.silver,
  gold: Colors.tiers.gold,
  platinum: Colors.tiers.platinum,
  diamond: Colors.tiers.diamond,
};

interface FriendPR {
  display_name: string;
  exercise_name: string;
  weight: number;
  reps: number;
  achieved_at: string;
  unit_pref: 'lbs' | 'kg';
}

interface LastWorkout {
  name: string;
  started_at: string;
  ended_at: string;
  sets_count: number;
  total_volume: number;
  exercises: string[];
}

export default function HomeScreen() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [friendPRs, setFriendPRs] = useState<FriendPR[]>([]);
  const [lastWorkout, setLastWorkout] = useState<LastWorkout | null>(null);
  const [animeResult, setAnimeResult] = useState<AnimeTierResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstSteps, setFirstSteps] = useState<{
    hasWorkout: boolean;
    hasFriend: boolean;
    hasCoach: boolean;
  } | null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [weeklyPlanModal, setWeeklyPlanModal] = useState(false);
  const [trainingDays, setTrainingDays] = useState('4');

  // SBD manual entry
  const [sbdModalOpen, setSbdModalOpen] = useState(false);
  const [sbdInputs, setSbdInputs] = useState({ sq: '', bp: '', dl: '' });
  const [sbdSaving, setSbdSaving] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user, profile?.bodyweight_lbs]);

  const fetchData = async () => {
    try {
      const uid = user!.id;
      // Check first steps completion
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const [{ count: workoutCount }, { count: friendCount }, weeklyPlanDone, { data: creator }] = await Promise.all([
        supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', uid).not('ended_at', 'is', null),
        supabase.from('friendships').select('id', { count: 'exact', head: true }).or(`requester_id.eq.${uid},addressee_id.eq.${uid}`).eq('status', 'accepted'),
        AsyncStorage.getItem(`weekly_plan_done_${uid}`),
        supabase.from('users').select('id').eq('is_owner', true).single(),
      ]);
      const hasWorkout = (workoutCount ?? 0) > 0;
      const hasFriend = (friendCount ?? 0) > 0;
      const hasCoach = weeklyPlanDone === 'true';
      if (creator?.id) setCreatorId(creator.id);
      const allDone = hasWorkout && hasFriend && hasCoach;
      setFirstSteps(allDone ? null : { hasWorkout, hasFriend, hasCoach });
      const [prRes, workoutRes, friendRes] = await Promise.all([
        // SBD PRs for anime tier
        supabase
          .from('personal_records')
          .select('weight, reps, achieved_at, exercises!inner(name)')
          .eq('user_id', uid)
          .in('exercises.name', ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts'])
          .order('achieved_at', { ascending: false }),

        // Last completed workout
        supabase
          .from('workouts')
          .select('name, started_at, ended_at, workout_sets(weight, reps, exercises(name))')
          .eq('user_id', uid)
          .not('ended_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Friends' recent PRs
        supabase
          .from('personal_records')
          .select('weight, reps, achieved_at, exercises(name), users!inner(display_name, unit_pref)')
          .neq('user_id', uid)
          .order('achieved_at', { ascending: false })
          .limit(8),
      ]);

      // Anime tier
      if (prRes.data) {
        const prs = prRes.data.map((p: any) => ({
          exerciseName: p.exercises?.name ?? '',
          weight: p.weight,
          reps: p.reps,
          achievedAt: p.achieved_at,
        }));
        // useDecay=true: rank based on last 6 months only
        setAnimeResult(getAnimeTierResult(prs, profile?.bodyweight_lbs ?? 185, true));
      } else {
        setAnimeResult(getAnimeTierResult([], profile?.bodyweight_lbs ?? 185));
      }

      // Last workout
      if (workoutRes.data) {
        const w = workoutRes.data as any;
        const sets = w.workout_sets ?? [];
        setLastWorkout({
          name: w.name,
          started_at: w.started_at,
          ended_at: w.ended_at,
          sets_count: sets.length,
          total_volume: sets.reduce((s: number, x: any) => s + x.weight * x.reps, 0),
          exercises: [...new Set(sets.map((s: any) => s.exercises?.name).filter(Boolean))] as string[],
        });
      }

      // Friend PRs
      if (friendRes.data) {
        setFriendPRs(friendRes.data.map((pr: any) => ({
          display_name: pr.users.display_name,
          exercise_name: pr.exercises.name,
          weight: pr.weight,
          reps: pr.reps,
          achieved_at: pr.achieved_at,
          unit_pref: pr.users.unit_pref,
        })));
      }
    } catch (e) {
      // silence
    } finally {
      setLoading(false);
    }
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    if (d === 1) return 'yesterday';
    return `${d}d ago`;
  };

  const formatDuration = (start: string, end: string) => {
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const formatVolume = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);

  const saveSBD = async () => {
    if (!user) return;
    const entries = [
      { key: 'barbell back squats', val: sbdInputs.sq, name: 'Barbell Back Squats' },
      { key: 'barbell bench press', val: sbdInputs.bp, name: 'Barbell Bench Press' },
      { key: 'deadlifts',           val: sbdInputs.dl, name: 'Deadlifts' },
    ].filter(e => parseFloat(e.val) > 0);

    if (entries.length === 0) { Alert.alert('Enter at least one lift'); return; }
    setSbdSaving(true);
    try {
      // Get exercise IDs
      const { data: exRows } = await supabase
        .from('exercises')
        .select('id, name')
        .in('name', entries.map(e => e.name));

      if (!exRows?.length) throw new Error('Exercises not found');

      for (const entry of entries) {
        const ex = exRows.find(e => e.name.toLowerCase() === entry.key);
        if (!ex) continue;
        await supabase.from('personal_records').upsert({
          user_id: user.id,
          exercise_id: ex.id,
          weight: parseFloat(entry.val),
          reps: 1,
          achieved_at: new Date().toISOString(),
        }, { onConflict: 'user_id,exercise_id' });
      }

      setSbdModalOpen(false);
      setSbdInputs({ sq: '', bp: '', dl: '' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchData(); // refresh
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSbdSaving(false);
    }
  };

  const goToCoachWithQuestion = (question: string) => {
    // Store in global so insights tab picks it up
    (global as any).__coachPreFill = question;
    router.push('/(tabs)/insights');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>

        {/* Greeting */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: Colors.textMuted, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
            {getTimeOfDay()}
          </Text>
          <Text style={{ color: Colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -1, marginTop: 2 }}>
            {profile?.display_name?.split(' ')[0] ?? 'Athlete'}
          </Text>
          {animeResult && (
            <Text style={{ color: animeResult.animeTier.color, fontSize: 12, fontWeight: '700', marginTop: 3, letterSpacing: 1.5 }}>
              {animeResult.animeTier.label} {ROMAN[animeResult.subTier]}
            </Text>
          )}
        </View>

        {/* ── FIRST STEPS ─────────────────────────────────────────── */}
        {firstSteps && (
          <View style={{
            backgroundColor: Colors.surface,
            borderRadius: 18, marginBottom: 14,
            borderWidth: 1, borderColor: Colors.accent + '30',
            overflow: 'hidden',
          }}>
            <View style={{
              padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
              flexDirection: 'row', alignItems: 'center', gap: 10,
            }}>
              <Text style={{ fontSize: 18 }}>🗺️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800' }}>Getting Started</Text>
                <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 1 }}>
                  {[firstSteps.hasWorkout, firstSteps.hasFriend, firstSteps.hasCoach].filter(Boolean).length} of 3 complete
                </Text>
              </View>
              {/* mini progress */}
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[firstSteps.hasWorkout, firstSteps.hasFriend, firstSteps.hasCoach].map((done, i) => (
                  <View key={i} style={{
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: done ? Colors.accent : Colors.surface2,
                    borderWidth: done ? 0 : 1, borderColor: Colors.border,
                  }} />
                ))}
              </View>
            </View>

            {/* Task 1 — Log first workout */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/workout')}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
                opacity: firstSteps.hasWorkout ? 0.5 : 1,
              }}
            >
              <View style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: firstSteps.hasWorkout ? Colors.success + '20' : Colors.surface2,
                borderWidth: 1, borderColor: firstSteps.hasWorkout ? Colors.success : Colors.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 14 }}>{firstSteps.hasWorkout ? '✓' : '🏋️'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700', textDecorationLine: firstSteps.hasWorkout ? 'line-through' : 'none' }}>
                  Log your first workout
                </Text>
                <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 1 }}>Track sets, reps, and weight</Text>
              </View>
              {!firstSteps.hasWorkout && <Text style={{ color: Colors.accent, fontSize: 13 }}>→</Text>}
            </TouchableOpacity>

            {/* Task 2 — Ask Coach to build weekly plan */}
            <TouchableOpacity
              onPress={() => !firstSteps?.hasCoach && setWeeklyPlanModal(true)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
                opacity: firstSteps.hasCoach ? 0.5 : 1,
              }}
            >
              <View style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: firstSteps.hasCoach ? Colors.success + '20' : Colors.surface2,
                borderWidth: 1, borderColor: firstSteps.hasCoach ? Colors.success : Colors.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 14 }}>{firstSteps.hasCoach ? '✓' : '⚡'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700', textDecorationLine: firstSteps.hasCoach ? 'line-through' : 'none' }}>
                  Get your weekly plan from Coach
                </Text>
                <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 1 }}>AI builds a program around your goals</Text>
              </View>
              {!firstSteps.hasCoach && <Text style={{ color: Colors.accent, fontSize: 13 }}>→</Text>}
            </TouchableOpacity>

            {/* Task 3 — Add a friend — open creator profile directly */}
            <TouchableOpacity
              onPress={() => {
                if (firstSteps?.hasFriend) return;
                if (creatorId) {
                  (global as any).__openFriendProfile = creatorId;
                }
                router.push('/(tabs)/friends');
              }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: 14,
                opacity: firstSteps.hasFriend ? 0.5 : 1,
              }}
            >
              <View style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: firstSteps.hasFriend ? Colors.success + '20' : Colors.surface2,
                borderWidth: 1, borderColor: firstSteps.hasFriend ? Colors.success : Colors.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 14 }}>{firstSteps.hasFriend ? '✓' : '👥'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700', textDecorationLine: firstSteps.hasFriend ? 'line-through' : 'none' }}>
                  Add your first friend
                </Text>
                <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 1 }}>Tap to add <Text style={{ color: Colors.accent }}>@beastyvas</Text> — the creator 👑</Text>
              </View>
              {!firstSteps.hasFriend && <Text style={{ color: Colors.accent, fontSize: 13 }}>→</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── ANIME TIER CARD (moved to profile) ──────────────────── */}
        {false && animeResult && (
          <View style={{
            backgroundColor: Colors.surface,
            borderRadius: 20,
            padding: 20,
            marginBottom: 14,
            borderWidth: 1.5,
            borderColor: animeResult.animeTier.color + '60',
            overflow: 'hidden',
          }}>
            {/* Tier label */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <View style={{
                backgroundColor: animeResult.animeTier.color + '20',
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}>
                <Text style={{
                  color: animeResult.animeTier.color,
                  fontSize: 11,
                  fontWeight: '900',
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}>
                  {animeResult.animeTier.label}
                </Text>
              </View>
              {animeResult.lifts.some(l => l.weight > 0) && (
                <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                  SBD avg · {animeResult.avgScore.toFixed(1)} / 5.0
                </Text>
              )}
            </View>

            <Text style={{
              color: Colors.text,
              fontSize: 15,
              fontStyle: 'italic',
              lineHeight: 22,
              marginBottom: 18,
              opacity: 0.85,
            }}>
              "{animeResult.animeTier.tagline}"
            </Text>

            {/* SBD bars */}
            <View style={{ gap: 10 }}>
              {animeResult.lifts.map((lift, i) => {
                const hasData = lift.weight > 0;
                const pct = Math.min(lift.tierScore / 5, 1);
                return (
                  <View key={i}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '800', width: 22 }}>
                          {lift.label}
                        </Text>
                        {hasData && (
                          <Text style={{ color: Colors.textSecondary, fontSize: 11 }}>
                            {lift.weight} lbs
                          </Text>
                        )}
                      </View>
                      {hasData ? (
                        <View style={{
                          backgroundColor: TIER_COLORS[lift.tier] + '20',
                          borderRadius: 5,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                        }}>
                          <Text style={{ color: TIER_COLORS[lift.tier], fontSize: 10, fontWeight: '800' }}>
                            {lift.tier.toUpperCase()}
                          </Text>
                        </View>
                      ) : (
                        <Text style={{ color: Colors.textMuted, fontSize: 11 }}>not logged</Text>
                      )}
                    </View>
                    {/* Progress bar */}
                    <View style={{
                      height: 5,
                      backgroundColor: Colors.surface2,
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}>
                      <View style={{
                        height: '100%',
                        width: hasData ? `${pct * 100}%` : '2%',
                        backgroundColor: hasData ? TIER_COLORS[lift.tier] : Colors.border,
                        borderRadius: 3,
                      }} />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Bottom actions */}
            <View style={{
              marginTop: 16,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: Colors.border,
              gap: 10,
            }}>
              {/* Next tier hint */}
              {animeResult.nextAnimeTier && animeResult.lifts.some(l => l.weight > 0) && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
                      Next: {animeResult.nextAnimeTier.label}
                    </Text>
                    {getNextTierGap(animeResult) && (
                      <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                        {getNextTierGap(animeResult)}
                      </Text>
                    )}
                  </View>
                  <View style={{
                    paddingHorizontal: 10, paddingVertical: 5,
                    borderRadius: 8, borderWidth: 1,
                    borderColor: animeResult.nextAnimeTier.color + '40',
                  }}>
                    <Text style={{ color: animeResult.nextAnimeTier.color, fontSize: 11, fontWeight: '800' }}>
                      {animeResult.nextAnimeTier.label}
                    </Text>
                  </View>
                </View>
              )}

              {/* Weakest lift → Coach */}
              {animeResult.bottleneck && animeResult.bottleneck.weight > 0 && (
                <TouchableOpacity
                  onPress={() => goToCoachWithQuestion(
                    `My ${animeResult.bottleneck!.exercise} is my weakest SBD lift at ${animeResult.bottleneck!.weight} lbs (${animeResult.bottleneck!.tier} tier). What's the most effective way to bring it up? Give me a real program adjustment, not generic advice.`
                  )}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: Colors.surface2,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>⚡</Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: '600', flex: 1 }}>
                    Ask coach: how to bring up your {animeResult.bottleneck.label}
                  </Text>
                  <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700' }}>→</Text>
                </TouchableOpacity>
              )}

              {/* Set SBD manually */}
              <TouchableOpacity
                onPress={() => setSbdModalOpen(true)}
                style={{
                  alignItems: 'center',
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: Colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                  {animeResult.lifts.some(l => l.weight > 0) ? 'Update your SBD maxes' : 'Set your SBD maxes manually →'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── START WORKOUT ───────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/workout')}
          style={{
            backgroundColor: Colors.accent,
            borderRadius: 16,
            padding: 22,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: Colors.text, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4, opacity: 0.8 }}>
            Ready to train?
          </Text>
          <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
            Start Workout →
          </Text>
        </TouchableOpacity>

        {/* ── LAST WORKOUT ────────────────────────────────────────── */}
        {lastWorkout && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/history')}
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 14,
              padding: 16,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>
                  Last Session
                </Text>
                <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                  {lastWorkout.name}
                </Text>
              </View>
              <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                {timeAgo(lastWorkout.started_at)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 20, marginBottom: lastWorkout.exercises.length > 0 ? 10 : 0 }}>
              {[
                { label: 'Duration', value: formatDuration(lastWorkout.started_at, lastWorkout.ended_at) },
                { label: 'Sets', value: String(lastWorkout.sets_count) },
                { label: 'Volume', value: `${formatVolume(lastWorkout.total_volume)} lbs` },
              ].map((s, i) => (
                <View key={i}>
                  <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>{s.label}</Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 2 }}>{s.value}</Text>
                </View>
              ))}
            </View>
            {lastWorkout.exercises.length > 0 && (
              <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                {lastWorkout.exercises.slice(0, 3).join(' · ')}
                {lastWorkout.exercises.length > 3 ? ` +${lastWorkout.exercises.length - 3}` : ''}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* ── AI COACH ────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/insights')}
          style={{
            backgroundColor: Colors.surface,
            borderRadius: 14,
            padding: 16,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: Colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: Colors.accentDim,
            borderWidth: 1,
            borderColor: Colors.accent + '40',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 18 }}>⚡</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>AI Coach</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 1 }}>
              Volume trends, recovery flags, pattern analysis
            </Text>
          </View>
          <Text style={{ color: Colors.textMuted, fontSize: 20 }}>›</Text>
        </TouchableOpacity>

        {/* ── FRIEND ACTIVITY ─────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>
            Crew Activity
          </Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/friends')}>
            <Text style={{ color: Colors.accent, fontSize: 11, fontWeight: '700' }}>See all →</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.textMuted} />
        ) : friendPRs.length === 0 ? (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/friends')}
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 14, padding: 20,
              borderWidth: 1, borderColor: Colors.border,
              alignItems: 'center', gap: 6,
            }}
          >
            <Text style={{ fontSize: 28 }}>👥</Text>
            <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>No crew yet</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Add friends to see their PRs here</Text>
            <View style={{
              marginTop: 4,
              backgroundColor: Colors.accentDim,
              borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7,
              borderWidth: 1, borderColor: Colors.accent + '40',
            }}>
              <Text style={{ color: Colors.accent, fontWeight: '700', fontSize: 12 }}>Find Friends →</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={{ gap: 8 }}>
            {/* Group by friend — show one card per person with their best recent PR */}
            {Object.entries(
              friendPRs.reduce<Record<string, typeof friendPRs>>((acc, pr) => {
                if (!acc[pr.display_name]) acc[pr.display_name] = [];
                acc[pr.display_name].push(pr);
                return acc;
              }, {})
            ).slice(0, 3).map(([name, prs], i) => {
              const topPR = prs[0]; // already sorted by achieved_at desc
              const otherCount = prs.length - 1;
              return (
                <View key={i} style={{
                  backgroundColor: Colors.surface,
                  borderRadius: 14, padding: 14,
                  borderWidth: 1, borderColor: Colors.border,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <View style={{
                      width: 32, height: 32, borderRadius: 16,
                      backgroundColor: Colors.goldDim,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 14 }}>🏆</Text>
                    </View>
                    <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', flex: 1 }}>{name}</Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 11 }}>{timeAgo(topPR.achieved_at)}</Text>
                  </View>
                  <Text style={{ color: Colors.gold, fontSize: 13, fontWeight: '700' }}>
                    {topPR.exercise_name} — {topPR.weight} {topPR.unit_pref}{topPR.reps > 1 ? ` × ${topPR.reps}` : ''}
                  </Text>
                  {otherCount > 0 && (
                    <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 4 }}>
                      +{otherCount} more PR{otherCount !== 1 ? 's' : ''} this session
                    </Text>
                  )}
                </View>
              );
            })}
            <TouchableOpacity onPress={() => router.push('/(tabs)/friends')} style={{ alignItems: 'center', padding: 8 }}>
              <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700' }}>
                See full feed →
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Weekly Plan Prompt Modal */}
        <Modal visible={weeklyPlanModal} transparent animationType="slide">
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={() => setWeeklyPlanModal(false)} />
            <View style={{
              backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
              padding: 24, borderTopWidth: 1, borderTopColor: Colors.border, gap: 16,
            }}>
              <View>
                <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '900' }}>Build your weekly plan</Text>
                <Text style={{ color: Colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 19 }}>
                  Coach will build you a full week of training based on your goals. This uses one of your free Coach asks.
                </Text>
              </View>
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
                  How many days per week can you train?
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {['2', '3', '4', '5', '6'].map(d => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setTrainingDays(d)}
                      style={{
                        flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
                        backgroundColor: trainingDays === d ? Colors.accent : Colors.surface2,
                        borderWidth: 1, borderColor: trainingDays === d ? Colors.accent : Colors.border,
                      }}
                    >
                      <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 16 }}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  setWeeklyPlanModal(false);
                  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                  if (user) await AsyncStorage.setItem(`weekly_plan_done_${user.id}`, 'true');
                  setFirstSteps(prev => prev ? { ...prev, hasCoach: true } : null);
                  const msg = `Build me a personalized ${trainingDays}-day per week workout program. I'm ${profile?.experience_level ?? 'intermediate'} level, training for ${profile?.primary_goal ?? 'general fitness'}, with a ${profile?.training_style ?? 'hybrid'} style. Give me specific days (e.g. Monday/Wednesday/Friday), exercises with sets and reps, and rest days. Make it progressive and realistic.`;
                  (global as any).__coachPreFill = msg;
                  router.push('/(tabs)/insights');
                }}
                style={{ backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
              >
                <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 15 }}>Build My Plan → (uses 1 ask)</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* SBD Entry Modal */}
        <Modal visible={sbdModalOpen} transparent animationType="slide">
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
              activeOpacity={1}
              onPress={() => setSbdModalOpen(false)}
            />
            <View style={{
              backgroundColor: Colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              borderTopWidth: 1,
              borderTopColor: Colors.border,
              gap: 16,
            }}>
              <View>
                <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '900' }}>Your SBD Maxes</Text>
                <Text style={{ color: Colors.textMuted, fontSize: 13, marginTop: 4 }}>
                  Enter your best single or a heavy set of 3-5. We'll use this to calculate your tier.
                </Text>
              </View>

              {[
                { label: 'Squat', key: 'sq' as const, placeholder: '315' },
                { label: 'Bench', key: 'bp' as const, placeholder: '225' },
                { label: 'Deadlift', key: 'dl' as const, placeholder: '405' },
              ].map(({ label, key, placeholder }) => (
                <View key={key}>
                  <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
                    {label} (lbs)
                  </Text>
                  <TextInput
                    value={sbdInputs[key]}
                    onChangeText={v => setSbdInputs(prev => ({ ...prev, [key]: v }))}
                    keyboardType="number-pad"
                    placeholder={placeholder}
                    placeholderTextColor={Colors.textMuted}
                    style={{
                      backgroundColor: Colors.surface2,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      color: Colors.text,
                      fontSize: 28,
                      fontWeight: '800',
                      letterSpacing: -1,
                      borderWidth: 1,
                      borderColor: Colors.border,
                    }}
                  />
                </View>
              ))}

              <TouchableOpacity
                onPress={saveSBD}
                disabled={sbdSaving}
                style={{
                  backgroundColor: Colors.accent,
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: 'center',
                  marginTop: 4,
                }}
              >
                {sbdSaving
                  ? <ActivityIndicator color={Colors.text} />
                  : <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 16 }}>SAVE & CALCULATE TIER</Text>
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
