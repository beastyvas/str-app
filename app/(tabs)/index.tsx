import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors, TierName } from '@/constants/colors';
import { TIER_ORDER } from '@/constants/strengthStandards';
import { getAnimeTierResult, getNextTierGap, AnimeTierResult, SBD_EXERCISES, ROMAN } from '@/constants/animeTiers';
import { CelebrationToast } from '@/components/CelebrationToast';
import { TierLadderModal } from '@/components/TierLadderModal';
import { useSubscription } from '@/hooks/useSubscription';

const TIER_COLORS: Record<TierName, string> = {
  beginner: Colors.tiers.beginner,
  bronze: Colors.tiers.bronze,
  silver: Colors.tiers.silver,
  gold: Colors.tiers.gold,
  platinum: Colors.tiers.platinum,
  diamond: Colors.tiers.diamond,
};

const SESSION_COLORS: Record<string, string> = {
  Push: '#D4197A',
  Pull: '#3B82F6',
  Legs: '#F97316',
  Upper: '#A855F7',
  Lower: '#22C55E',
  'Full Body': '#EAB308',
  Core: '#14B8A6',
  Training: '#888888',
};

const SESSION_EMOJI: Record<string, string> = {
  Push: '💪',
  Pull: '🎯',
  Legs: '🦵',
  Upper: '⬆️',
  Lower: '🔽',
  'Full Body': '🔥',
  Core: '🧘',
  Training: '🏋️',
};

function classifySession(exercises: string[]): string | null {
  const s = exercises.join(' ').toLowerCase();
  const push = /bench|chest|fly|press|tricep|shoulder|dip/.test(s);
  const pull = /row|pull-?up|chin|lat|curl|bicep|shrug/.test(s);
  const legs = /squat|leg press|lunge|hamstring|glute|calf|hip thrust|rdl/.test(s);
  const core = /crunch|plank|\bab\b|core|oblique/.test(s);
  if (push && pull && legs) return 'Full Body';
  if ((push || pull) && legs) return 'Upper';
  if (push && pull) return 'Upper';
  if (push) return 'Push';
  if (pull) return 'Pull';
  if (legs) return 'Legs';
  if (core) return 'Core';
  return null;
}

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
  const { isPro, aiAsksRemaining } = useSubscription();
  const router = useRouter();
  const [friendPRs, setFriendPRs] = useState<FriendPR[]>([]);
  const [lastWorkout, setLastWorkout] = useState<LastWorkout | null>(null);
  const [animeResult, setAnimeResult] = useState<AnimeTierResult | null>(null);
  const [tierReady, setTierReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [firstSteps, setFirstSteps] = useState<{
    hasWorkout: boolean;
    hasFriend: boolean;
    hasCoach: boolean;
  } | null>(null);
  const prevFirstSteps = useRef<typeof firstSteps>(null);
  const [celebration, setCelebration] = useState<{ emoji: string; title: string; sub: string } | null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [weeklyPlanModal, setWeeklyPlanModal] = useState(false);
  const [trainingDays, setTrainingDays] = useState('4');
  const [recentFriendPost, setRecentFriendPost] = useState<{
    displayName: string;
    workoutName: string;
    notes?: string;
    exercises: string[];
    endedAt: string;
  } | null>(null);
  const [workoutDays, setWorkoutDays] = useState<Record<number, string>>({});

  const [showTierLadder, setShowTierLadder] = useState(false);

  // SBD manual entry
  const [sbdModalOpen, setSbdModalOpen] = useState(false);
  const [sbdInputs, setSbdInputs] = useState({ sq: '', bp: '', dl: '' });
  const [sbdSaving, setSbdSaving] = useState(false);

  // Premium animations
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const rankOpacity = useRef(new Animated.Value(0)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;

  // Fade in content after load
  useEffect(() => {
    if (!loading) {
      Animated.timing(contentOpacity, { toValue: 1, duration: 380, useNativeDriver: true }).start();
    } else {
      contentOpacity.setValue(0);
    }
  }, [loading]);

  // Fade in rank once ready
  useEffect(() => {
    if (tierReady && animeResult) {
      Animated.spring(rankOpacity, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }).start();
    }
  }, [tierReady, animeResult]);

  // CTA pulse glow
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, { toValue: 0.65, duration: 1800, useNativeDriver: true }),
        Animated.timing(ctaPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Single source of truth — useFocusEffect handles both initial load and returns
  useFocusEffect(useCallback(() => {
    if (user) fetchData();
  }, [user, profile?.bodyweight_lbs]));

  const fetchData = async () => {
    try {
      const uid = user!.id;
      // Check first steps completion
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const [{ count: workoutCount }, { count: friendCount }, weeklyPlanDone, { data: creator }] = await Promise.all([
        supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', uid).not('ended_at', 'is', null),
        // Any friendship attempt (pending or accepted) marks this done
        supabase.from('friendships').select('id', { count: 'exact', head: true }).or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
        AsyncStorage.getItem(`weekly_plan_done_${uid}`),
        supabase.from('users').select('id').eq('is_owner', true).single(),
      ]);
      const hasWorkout = (workoutCount ?? 0) > 0;
      const hasFriend = (friendCount ?? 0) > 0;
      const hasCoach = weeklyPlanDone === 'true';
      if (creator?.id) setCreatorId(creator.id);
      const allDone = hasWorkout && hasFriend && hasCoach;
      const newSteps = allDone ? null : { hasWorkout, hasFriend, hasCoach };

      // Check AsyncStorage flags for celebrations — reliable, not state-comparison-based
      const [workoutCelebrated, friendCelebrated, onboardingDone, planPending] = await Promise.all([
        AsyncStorage.getItem(`celebrated_workout_${uid}`),
        AsyncStorage.getItem(`celebrated_friend_${uid}`),
        AsyncStorage.getItem(`onboarding_done_${uid}`),
        AsyncStorage.getItem(`celebrated_plan_${uid}`),
      ]);

      if (onboardingDone === 'pending') {
        await AsyncStorage.setItem(`onboarding_done_${uid}`, 'shown');
        setCelebration({ emoji: '🎉', title: "You're in the system!", sub: 'Your arc officially begins. Go crush it.' });
      } else if (planPending === 'pending') {
        await AsyncStorage.setItem(`celebrated_plan_${uid}`, 'shown');
        setCelebration({ emoji: '⚡', title: 'Plan is being built!', sub: 'Coach is on it. Check the Insights tab.' });
      } else if (hasWorkout && !workoutCelebrated) {
        await AsyncStorage.setItem(`celebrated_workout_${uid}`, 'true');
        setCelebration({ emoji: '🔥', title: 'First workout logged!', sub: 'Your arc has officially begun.' });
      } else if (hasFriend && !friendCelebrated) {
        await AsyncStorage.setItem(`celebrated_friend_${uid}`, 'true');
        setCelebration({ emoji: '👥', title: 'Squad secured!', sub: 'Your crew is building.' });
      }
      setFirstSteps(newSteps);
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

      // Anime tier — only set after fresh fetch, never from stale state
      const bw = Math.max(profile?.bodyweight_lbs ?? 185, 50); // guard against sub-50 lbs
      if (prRes.data) {
        const prs = prRes.data.map((p: any) => ({
          exerciseName: p.exercises?.name ?? '',
          weight: p.weight,
          reps: p.reps,
          achievedAt: p.achieved_at,
        }));
        setAnimeResult(getAnimeTierResult(prs, bw, true));
      } else {
        setAnimeResult(getAnimeTierResult([], bw));
      }
      setTierReady(true);

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

      // Most recent friend workout post for crew activity card
      const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
        .eq('status', 'accepted');
      const friendIds = (friendships ?? []).map(f =>
        f.requester_id === uid ? f.addressee_id : f.requester_id
      );
      if (friendIds.length > 0) {
        const { data: recentPost } = await supabase
          .from('workouts')
          .select('name, ended_at, notes, user_id, workout_sets(exercises(name)), users!inner(display_name)')
          .in('user_id', friendIds)
          .not('ended_at', 'is', null)
          .order('ended_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (recentPost) {
          const sets = (recentPost as any).workout_sets ?? [];
          const exs = [...new Set(sets.map((s: any) => s.exercises?.name).filter(Boolean))] as string[];
          setRecentFriendPost({
            displayName: (recentPost as any).users?.display_name ?? 'Friend',
            workoutName: recentPost.name,
            notes: recentPost.notes?.trim() || undefined,
            exercises: exs,
            endedAt: recentPost.ended_at!,
          });
        } else {
          setRecentFriendPost(null);
        }
      }

      // Last 7 days of own workouts for weekly strip
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: weekData } = await supabase
        .from('workouts')
        .select('started_at, workout_sets(exercises(name))')
        .eq('user_id', uid)
        .not('ended_at', 'is', null)
        .gte('started_at', sevenDaysAgo);
      if (weekData) {
        const days: Record<number, string> = {};
        (weekData as any[]).forEach(w => {
          const dow = new Date(w.started_at).getDay();
          const exs = (w.workout_sets ?? []).map((s: any) => s.exercises?.name).filter(Boolean);
          days[dow] = classifySession(exs) ?? 'Training';
        });
        setWorkoutDays(days);
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

  // Derived — today's planned session from configured split
  const todaySession: string | null = (() => {
    const schedule = (profile as any)?.split_schedule as Record<string, string> | null;
    if (!schedule) return null;
    return schedule[String(new Date().getDay())] ?? null;
  })();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={{ color: Colors.textMuted, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Loading
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <Animated.ScrollView
        style={{ opacity: contentOpacity }}
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
      >

        {/* ── GREETING + RANK BADGE ────────────────────────────────── */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{
            color: Colors.textMuted,
            fontSize: 11,
            letterSpacing: 2.5,
            textTransform: 'uppercase',
          }}>
            {getSmartGreetingLine(lastWorkout, todaySession)}
          </Text>
          <Text style={{
            color: Colors.text,
            fontSize: 32,
            fontWeight: '900',
            letterSpacing: -1.5,
            marginTop: 4,
            lineHeight: 36,
          }}>
            {profile?.display_name?.split(' ')[0] ?? 'Athlete'}
          </Text>

          {/* Prominent rank badge with tagline */}
          <Animated.View style={{ opacity: rankOpacity, marginTop: 12 }}>
            {animeResult && (
              <TouchableOpacity
                onPress={() => setShowTierLadder(true)}
                activeOpacity={0.85}
                style={{
                  backgroundColor: animeResult.animeTier.color + '12',
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: animeResult.animeTier.color + '35',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{
                    color: animeResult.animeTier.color,
                    fontSize: 13,
                    fontWeight: '900',
                    letterSpacing: 2.5,
                    textTransform: 'uppercase',
                  }}>
                    {animeResult.animeTier.label} {ROMAN[animeResult.subTier]}
                  </Text>
                  <Text style={{
                    color: Colors.textSecondary,
                    fontSize: 12,
                    marginTop: 3,
                    fontStyle: 'italic',
                    lineHeight: 17,
                  }} numberOfLines={1}>
                    "{animeResult.animeTier.tagline}"
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={{ color: animeResult.animeTier.color, fontSize: 18, fontWeight: '900' }}>
                    {animeResult.avgScore.toFixed(1)}
                  </Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1 }}>/ 5.0</Text>
                </View>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>

        {/* ── TODAY'S MISSION + WEEKLY STRIP ──────────────────────── */}
        {(todaySession || Object.keys(workoutDays).length > 0) && (
          <View style={{
            backgroundColor: Colors.surface,
            borderRadius: 18,
            padding: 16,
            marginBottom: 14,
            borderWidth: 1,
            borderColor: todaySession
              ? (SESSION_COLORS[todaySession] ?? Colors.accent) + '40'
              : Colors.border,
          }}>
            {/* Today's planned session header */}
            {todaySession && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}>
                <View>
                  <Text style={{
                    color: Colors.textMuted,
                    fontSize: 10,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    fontWeight: '700',
                    marginBottom: 4,
                  }}>
                    Today's Mission
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 20 }}>{SESSION_EMOJI[todaySession] ?? '🏋️'}</Text>
                    <Text style={{
                      color: SESSION_COLORS[todaySession] ?? Colors.accent,
                      fontSize: 22,
                      fontWeight: '900',
                      letterSpacing: -0.5,
                    }}>
                      {todaySession}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/workout')}
                  style={{
                    backgroundColor: (SESSION_COLORS[todaySession] ?? Colors.accent) + '20',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: (SESSION_COLORS[todaySession] ?? Colors.accent) + '45',
                  }}
                >
                  <Text style={{
                    color: SESSION_COLORS[todaySession] ?? Colors.accent,
                    fontSize: 13,
                    fontWeight: '800',
                  }}>
                    Let's go →
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 7-day weekly strip */}
            {!todaySession && (
              <Text style={{
                color: Colors.textMuted,
                fontSize: 10,
                letterSpacing: 2,
                textTransform: 'uppercase',
                fontWeight: '700',
                marginBottom: 10,
              }}>
                This Week
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                const label = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dayIdx];
                const sessionType = workoutDays[dayIdx];
                const isToday = new Date().getDay() === dayIdx;
                const color = sessionType ? (SESSION_COLORS[sessionType] ?? '#888') : null;
                const isPlanned = isToday && todaySession && !sessionType;
                const plannedColor = isPlanned ? (SESSION_COLORS[todaySession!] ?? Colors.accent) : null;

                return (
                  <View key={dayIdx} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
                    <View style={{
                      width: '100%',
                      height: 36,
                      borderRadius: 9,
                      backgroundColor: color
                        ? color + '22'
                        : isPlanned && plannedColor
                          ? plannedColor + '10'
                          : Colors.surface2,
                      borderWidth: isToday ? 1.5 : 1,
                      borderColor: isToday
                        ? (color ?? plannedColor ?? Colors.accent)
                        : (color ? color + '55' : Colors.border),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {color ? (
                        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }} />
                      ) : isPlanned && plannedColor ? (
                        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: plannedColor, opacity: 0.4 }} />
                      ) : null}
                    </View>
                    <Text style={{
                      color: isToday ? Colors.text : Colors.textMuted,
                      fontSize: 9,
                      fontWeight: isToday ? '800' : '500',
                      letterSpacing: 0.3,
                    }}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

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
              onPress={() => {
                (global as any).__startFirstWorkout = true;
                router.push('/(tabs)/workout');
              }}
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

            {/* Ask Coach — right up top, easy to find */}
            {animeResult.bottleneck && animeResult.bottleneck.weight > 0 && (
              <TouchableOpacity
                onPress={() => {
                  const question = `My ${animeResult.bottleneck!.exercise} is my weakest SBD lift at ${animeResult.bottleneck!.weight} lbs. What's the most effective way to bring it up? Give me a real program adjustment.`;
                  if (isPro) {
                    (global as any).__coachPreFill = question;
                    router.push('/(tabs)/insights');
                  } else {
                    Alert.alert(
                      'Ask Coach',
                      `This will use 1 of your ${aiAsksRemaining} remaining asks this week.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Ask anyway', onPress: () => { (global as any).__coachPreFill = question; router.push('/(tabs)/insights'); } },
                      ]
                    );
                  }
                }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: animeResult.animeTier.color + '15',
                  borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
                  borderWidth: 1, borderColor: animeResult.animeTier.color + '30',
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontSize: 14 }}>⚡</Text>
                <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700', flex: 1 }}>
                  How to bring up my {animeResult.bottleneck.label}
                </Text>
                {!isPro && (
                  <Text style={{ color: Colors.textMuted, fontSize: 10 }}>{aiAsksRemaining} left</Text>
                )}
                <Text style={{ color: animeResult.animeTier.color, fontSize: 12, fontWeight: '800' }}>Ask →</Text>
              </TouchableOpacity>
            )}

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
        <View style={{ marginBottom: 14, position: 'relative' }}>
          {/* Pulse glow layer */}
          <Animated.View style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 18,
            backgroundColor: Colors.accent,
            opacity: ctaPulse.interpolate({ inputRange: [0.65, 1], outputRange: [0.18, 0] }),
            transform: [{ scale: ctaPulse.interpolate({ inputRange: [0.65, 1], outputRange: [1, 1.04] }) }],
          }} />
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/workout')}
            activeOpacity={0.88}
            style={{
              backgroundColor: Colors.accent,
              borderRadius: 18,
              padding: 22,
              shadowColor: Colors.accent,
              shadowOpacity: 0.4,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
              elevation: 10,
            }}
          >
            <Text style={{
              color: Colors.text,
              fontSize: 11,
              letterSpacing: 2.5,
              textTransform: 'uppercase',
              marginBottom: 6,
              opacity: 0.75,
              fontWeight: '700',
            }}>
              Ready to train?
            </Text>
            <Text style={{
              color: Colors.text,
              fontSize: 24,
              fontWeight: '900',
              letterSpacing: -0.5,
            }}>
              Start Workout →
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── LAST WORKOUT ────────────────────────────────────────── */}
        {lastWorkout && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/history')}
            activeOpacity={0.82}
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 18,
              padding: 18,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: Colors.textMuted,
                  fontSize: 10,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                  fontWeight: '700',
                }}>
                  Last Session
                </Text>
                <Text style={{
                  color: Colors.text,
                  fontSize: 15,
                  fontWeight: '800',
                  letterSpacing: -0.3,
                }} numberOfLines={1}>
                  {lastWorkout.name}
                </Text>
              </View>
              <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                {timeAgo(lastWorkout.started_at)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 24, marginBottom: lastWorkout.exercises.length > 0 ? 12 : 0 }}>
              {[
                { label: 'Duration', value: formatDuration(lastWorkout.started_at, lastWorkout.ended_at) },
                { label: 'Sets', value: String(lastWorkout.sets_count) },
                { label: 'Volume', value: `${formatVolume(lastWorkout.total_volume)} lbs` },
              ].map((s, i) => (
                <View key={i}>
                  <Text style={{
                    color: Colors.textMuted,
                    fontSize: 9,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    fontWeight: '700',
                  }}>
                    {s.label}
                  </Text>
                  <Text style={{
                    color: Colors.text,
                    fontSize: 16,
                    fontWeight: '800',
                    marginTop: 3,
                    letterSpacing: -0.3,
                  }}>
                    {s.value}
                  </Text>
                </View>
              ))}
            </View>
            {lastWorkout.exercises.length > 0 && (
              <Text style={{ color: Colors.textMuted, fontSize: 12, lineHeight: 18 }}>
                {lastWorkout.exercises.slice(0, 3).join(' · ')}
                {lastWorkout.exercises.length > 3 ? ` +${lastWorkout.exercises.length - 3}` : ''}
              </Text>
            )}
          </TouchableOpacity>
        )}


        {/* ── CREW ACTIVITY ────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/friends')}
          activeOpacity={0.85}
          style={{
            backgroundColor: Colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: recentFriendPost ? Colors.accent + '30' : Colors.border,
            overflow: 'hidden',
          }}
        >
          {recentFriendPost ? (
            <>
              {/* Header row with initials avatar */}
              <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: Colors.accent + '22',
                  borderWidth: 1, borderColor: Colors.accent + '40',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: Colors.accent, fontSize: 15, fontWeight: '900' }}>
                    {recentFriendPost.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '800' }}>{recentFriendPost.displayName}</Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 11 }}>{recentFriendPost.workoutName} · {timeAgo(recentFriendPost.endedAt)}</Text>
                </View>
                <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700' }}>Feed →</Text>
              </View>
              {recentFriendPost.notes && (
                <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 }}>
                  <Text style={{ color: Colors.text, fontSize: 13, lineHeight: 19 }} numberOfLines={2}>
                    {recentFriendPost.notes}
                  </Text>
                </View>
              )}
              {recentFriendPost.exercises.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingHorizontal: 14, paddingBottom: 12, paddingTop: recentFriendPost.notes ? 4 : 10 }}>
                  {recentFriendPost.exercises.slice(0, 4).map((ex, i) => (
                    <View key={i} style={{ backgroundColor: Colors.surface2, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 }}>
                      <Text style={{ color: Colors.textMuted, fontSize: 10 }}>{ex}</Text>
                    </View>
                  ))}
                  {recentFriendPost.exercises.length > 4 && (
                    <Text style={{ color: Colors.textMuted, fontSize: 10, alignSelf: 'center' }}>+{recentFriendPost.exercises.length - 4}</Text>
                  )}
                </View>
              )}
            </>
          ) : (
            <View style={{ padding: 20, alignItems: 'center', gap: 6 }}>
              <View style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: Colors.surface2,
                borderWidth: 1, borderColor: Colors.border,
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 6,
              }}>
                <Text style={{ fontSize: 26 }}>👥</Text>
              </View>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800' }}>No crew yet</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
                Add friends to see their sessions, PRs, and progress here
              </Text>
              <Text style={{ color: Colors.accent, fontSize: 13, fontWeight: '700', marginTop: 6 }}>
                Find friends →
              </Text>
            </View>
          )}
        </TouchableOpacity>

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
                  if (user) {
                    await AsyncStorage.setItem(`weekly_plan_done_${user.id}`, 'true');
                    await AsyncStorage.setItem(`celebrated_plan_${user.id}`, 'pending');
                  }
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

        {/* Tier Ladder */}
        <TierLadderModal visible={showTierLadder} onClose={() => setShowTierLadder(false)} result={animeResult} bodyweightLbs={profile?.bodyweight_lbs ?? 185} gender={profile?.gender} />

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
      </Animated.ScrollView>
      <CelebrationToast
        visible={!!celebration}
        emoji={celebration?.emoji ?? '🎉'}
        title={celebration?.title ?? ''}
        sub={celebration?.sub}
        onDone={() => setCelebration(null)}
      />
    </SafeAreaView>
  );
}

function getSmartGreetingLine(lastWorkout: LastWorkout | null, todaySession: string | null): string {
  const h = new Date().getHours();
  const timeStr = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';

  if (todaySession) {
    return `${todaySession} day · good ${timeStr}`;
  }

  if (lastWorkout) {
    const hoursAgo = (Date.now() - new Date(lastWorkout.started_at).getTime()) / 3600000;
    if (hoursAgo < 18) return 'recovery mode — rest up';
    if (hoursAgo < 30) return 'ready for round two?';
    if (hoursAgo < 54) return 'one day out — time to load up';
    if (hoursAgo < 80) return `two days since last session`;
  }

  if (h < 12) return 'good morning';
  if (h < 17) return 'good afternoon';
  return 'good evening';
}
