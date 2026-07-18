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
import { getNextTierGap, ROMAN } from '@/constants/ranks';
import { CelebrationToast } from '@/components/CelebrationToast';
import { TierLadderModal } from '@/components/TierLadderModal';
import { useSubscription } from '@/hooks/useSubscription';
import { toDisplay, toLbs, fmtVolume as fmtVolumeUnit, unitFromProfile } from '@/lib/units';
import { SESSION_COLORS, SESSION_EMOJI } from '@/lib/sessionType';
import { useHomeData, WorkoutDayData, LastWorkout } from '@/hooks/useHomeData';
import { HomeSkeleton } from '@/components/home/HomeSkeleton';

const TIER_COLORS: Record<TierName, string> = {
  beginner: Colors.tiers.beginner,
  bronze: Colors.tiers.bronze,
  silver: Colors.tiers.silver,
  gold: Colors.tiers.gold,
  platinum: Colors.tiers.platinum,
  diamond: Colors.tiers.diamond,
};

export default function HomeScreen() {
  const { profile, user } = useAuth();
  const unit = unitFromProfile(profile?.unit_pref);
  const isNewLifter = !profile?.experience_level || profile.experience_level === 'beginner';
  const { isPro, aiAsksRemaining } = useSubscription();
  const router = useRouter();
  // All Home data (SWR-cached: instant render on refocus, silent background
  // refresh, skeleton only on true first load) lives in useHomeData.
  const { data, loading, celebration, clearCelebration, refetch, markCoachStepDone } = useHomeData();
  const friendPRs = data?.friendPRs ?? [];
  const lastWorkout = data?.lastWorkout ?? null;
  const rankResult = data?.rankResult ?? null;
  const tierReady = data != null;
  const firstSteps = data?.firstSteps ?? null;
  const creatorId = data?.creatorId ?? null;
  const recentFriendPost = data?.recentFriendPost ?? null;
  const workoutDays = data?.workoutDays ?? {};

  const [weeklyPlanModal, setWeeklyPlanModal] = useState(false);
  const [trainingDays, setTrainingDays] = useState('4');
  const [selectedDayWorkout, setSelectedDayWorkout] = useState<(WorkoutDayData & { dow: number }) | null>(null);

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
    if (tierReady && rankResult) {
      Animated.spring(rankOpacity, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }).start();
    }
  }, [tierReady, rankResult]);

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
          // Typed in the user's display unit — stored canonical lbs
          weight: toLbs(parseFloat(entry.val), unit),
          reps: 1,
          achieved_at: new Date().toISOString(),
        }, { onConflict: 'user_id,exercise_id' });
      }

      setSbdModalOpen(false);
      setSbdInputs({ sq: '', bp: '', dl: '' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
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

  // Derived — today's planned session from configured split.
  // Once today's workout is already logged, fall through to the weekly
  // recap view instead of nagging "Today's Mission · Let's go →".
  const todayDow = new Date().getDay();
  const todayData = workoutDays[todayDow];
  const todaySession: string | null = (() => {
    if (todayData) return null;
    const schedule = (profile as any)?.split_schedule as Record<string, string> | null;
    if (!schedule) return null;
    return schedule[String(todayDow)] ?? null;
  })();

  // Skeleton only on true first load — refocus renders cached data instantly.
  if (loading && !data) {
    return <HomeSkeleton />;
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
            fontWeight: '800',
            letterSpacing: -1.5,
            marginTop: 4,
            lineHeight: 36,
          }}>
            {profile?.display_name?.split(' ')[0] ?? 'Athlete'}
          </Text>

          {/* Prominent rank badge with tagline */}
          <Animated.View style={{ opacity: rankOpacity, marginTop: 12 }}>
            {rankResult && (
              <TouchableOpacity
                onPress={() => setShowTierLadder(true)}
                activeOpacity={0.85}
                style={{
                  backgroundColor: rankResult.tier.color + '12',
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: rankResult.tier.color + '35',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{
                    color: rankResult.tier.color,
                    fontSize: 13, fontWeight: '800', letterSpacing: 2.5, textTransform: 'uppercase',
                  }}>
                    {rankResult.tier.label} {ROMAN[rankResult.subTier]}
                  </Text>
                  <Text style={{
                    color: Colors.textSecondary, fontSize: 12, marginTop: 3, fontStyle: 'italic', lineHeight: 17,
                  }} numberOfLines={1}>
                    "{rankResult.tier.tagline}"
                  </Text>
                  {/* Next gap + Ask Coach — right on the badge */}
                  {getNextTierGap(rankResult) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                      <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                        {getNextTierGap(rankResult)?.replace('+', '').replace(' lbs on ', ' lbs needed on ').replace(/(\w+)$/, '$1 to rank up')}
                      </Text>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation?.();
                          const question = `My ${rankResult.bottleneck!.exercise} is my weakest SBD lift at ${rankResult.bottleneck!.weight} lbs. What's the most effective way to bring it up? Give me a real program adjustment.`;
                          if (isPro) {
                            (global as any).__coachPreFill = question;
                            router.push('/(tabs)/insights');
                          } else {
                            Alert.alert('Ask Coach', `Uses 1 of your ${aiAsksRemaining} weekly asks.`, [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Ask', onPress: () => { (global as any).__coachPreFill = question; router.push('/(tabs)/insights'); } },
                            ]);
                          }
                        }}
                        style={{
                          backgroundColor: rankResult.tier.color + '25',
                          borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
                        }}
                      >
                        <Text style={{ color: rankResult.tier.color, fontSize: 10, fontWeight: '800' }}>
                          Ask Coach ⚡
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={{ color: rankResult.tier.color, fontSize: 18, fontWeight: '800' }}>
                    {rankResult.avgScore.toFixed(1)}
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
                      fontWeight: '800',
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
                const dayData = workoutDays[dayIdx];
                const isToday = new Date().getDay() === dayIdx;
                const color = dayData ? (SESSION_COLORS[dayData.sessionType] ?? '#888') : null;
                const isPlanned = isToday && todaySession && !dayData;
                const plannedColor = isPlanned ? (SESSION_COLORS[todaySession!] ?? Colors.accent) : null;
                const displayEmoji = dayData ? (SESSION_EMOJI[dayData.sessionType] ?? '🏋️') : null;

                return (
                  <TouchableOpacity
                    key={dayIdx}
                    style={{ flex: 1, alignItems: 'center', gap: 5 }}
                    disabled={!dayData}
                    onPress={() => dayData && setSelectedDayWorkout({ dow: dayIdx, ...dayData })}
                  >
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
                      {displayEmoji ? (
                        <Text style={{ fontSize: 16 }}>{displayEmoji}</Text>
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
                  </TouchableOpacity>
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

            {/* Task 2 — meet the coach. Beginners already have a 3-day starter
                plan, so their step is simply asking Coach a first question;
                experienced lifters still get the weekly-plan builder. */}
            <TouchableOpacity
              onPress={() => {
                if (firstSteps?.hasCoach) return;
                if (isNewLifter) {
                  if (user) {
                    import('@react-native-async-storage/async-storage')
                      .then(({ default: AS }) => AS.setItem(`weekly_plan_done_${user.id}`, 'true'));
                    supabase.from('users').update({ weekly_plan_done: true }).eq('id', user.id).then(() => {});
                  }
                  markCoachStepDone();
                  router.push('/(tabs)/insights');
                } else {
                  setWeeklyPlanModal(true);
                }
              }}
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
                  {isNewLifter ? 'Ask your coach anything' : 'Get your weekly plan from Coach'}
                </Text>
                <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 1 }}>
                  {isNewLifter ? 'Nervous questions welcome — 5 free a week' : 'AI builds a program around your goals'}
                </Text>
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
              fontWeight: '800',
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
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 3,
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
                { label: 'Volume', value: fmtVolumeUnit(lastWorkout.total_volume, unit) },
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
                  <Text style={{ color: Colors.accent, fontSize: 15, fontWeight: '800' }}>
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
                <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Build your weekly plan</Text>
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
                    // Durable server flag so the task doesn't reset on re-login/reinstall
                    await supabase.from('users').update({ weekly_plan_done: true }).eq('id', user.id);
                  }
                  markCoachStepDone();
                  const msg = `Build me a personalized ${trainingDays}-day per week workout program. I'm ${profile?.experience_level ?? 'intermediate'} level, training for ${profile?.primary_goal ?? 'general fitness'}, with a ${profile?.training_style ?? 'hybrid'} style. Give me specific days (e.g. Monday/Wednesday/Friday), exercises with sets and reps, and rest days. Make it progressive and realistic.`;
                  (global as any).__coachPreFill = msg;
                  router.push('/(tabs)/insights');
                }}
                style={{ backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
              >
                <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 15 }}>Build My Plan → (uses 1 ask)</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Tier Ladder */}
        <TierLadderModal visible={showTierLadder} onClose={() => setShowTierLadder(false)} result={rankResult} bodyweightLbs={profile?.bodyweight_lbs ?? 185} gender={profile?.gender} />

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
                <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Your SBD Maxes</Text>
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
                    {label} ({unit})
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
                      fontVariant: ['tabular-nums'],
                      letterSpacing: -0.5,
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
                  : <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 16 }}>SAVE & CALCULATE TIER</Text>
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Day workout detail modal */}
        <Modal visible={!!selectedDayWorkout} transparent animationType="slide" onRequestClose={() => setSelectedDayWorkout(null)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setSelectedDayWorkout(null)}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              {selectedDayWorkout && (() => {
                const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const dayEmoji = SESSION_EMOJI[selectedDayWorkout.sessionType] ?? '🏋️';

                return (
                  <View style={{
                    backgroundColor: Colors.surface,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    padding: 28,
                    paddingBottom: 40,
                    borderTopWidth: 1,
                    borderColor: Colors.border,
                  }}>
                    <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 24 }} />

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <Text style={{ fontSize: 48 }}>{dayEmoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>
                          {DAY_LABELS[selectedDayWorkout.dow]}
                        </Text>
                        <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '800' }} numberOfLines={1}>
                          {selectedDayWorkout.name}
                        </Text>
                        <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>
                          {selectedDayWorkout.durationMins >= 60
                            ? `${Math.floor(selectedDayWorkout.durationMins / 60)}h ${selectedDayWorkout.durationMins % 60}m`
                            : `${selectedDayWorkout.durationMins}m`}
                          {' · '}{selectedDayWorkout.sessionType}
                        </Text>
                      </View>
                    </View>

                    {selectedDayWorkout.topLifts.length > 0 && (
                      <View style={{ marginTop: 14 }}>
                        <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 8 }}>
                          Top Lifts
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {selectedDayWorkout.topLifts.map((lift, i) => (
                            <View key={i} style={{
                              backgroundColor: Colors.surface2,
                              borderRadius: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                            }}>
                              <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700' }}>
                                {lift.name}
                              </Text>
                              <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>
                                {toDisplay(lift.weight, unit)} {unit} × {lift.reps}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })()}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

      </Animated.ScrollView>
      <CelebrationToast
        visible={!!celebration}
        emoji={celebration?.emoji ?? '🎉'}
        title={celebration?.title ?? ''}
        sub={celebration?.sub}
        onDone={clearCelebration}
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
