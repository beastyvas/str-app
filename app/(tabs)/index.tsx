import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors, TierName } from '@/constants/colors';
import { TIER_ORDER } from '@/constants/strengthStandards';
import { getAnimeTierResult, getNextTierGap, AnimeTierResult } from '@/constants/animeTiers';

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

  useEffect(() => {
    if (user) fetchData();
  }, [user, profile?.bodyweight_lbs]);

  const fetchData = async () => {
    try {
      const uid = user!.id;
      const [prRes, workoutRes, friendRes] = await Promise.all([
        // SBD PRs for anime tier
        supabase
          .from('personal_records')
          .select('weight, reps, exercises!inner(name)')
          .eq('user_id', uid)
          .in('exercises.name', ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts']),

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
        }));
        setAnimeResult(getAnimeTierResult(prs, profile?.bodyweight_lbs ?? 185));
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
        </View>

        {/* ── ANIME TIER CARD ─────────────────────────────────────── */}
        {animeResult && (
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

            {/* Next tier hint */}
            {animeResult.nextAnimeTier && animeResult.lifts.some(l => l.weight > 0) && (
              <View style={{
                marginTop: 16,
                paddingTop: 14,
                borderTopWidth: 1,
                borderTopColor: Colors.border,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <View>
                  <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
                    Next: {animeResult.nextAnimeTier.label}
                  </Text>
                  {getNextTierGap(animeResult) && (
                    <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700', marginTop: 3 }}>
                      {getNextTierGap(animeResult)}
                    </Text>
                  )}
                </View>
                <View style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: animeResult.nextAnimeTier.color + '40',
                }}>
                  <Text style={{ color: animeResult.nextAnimeTier.color, fontSize: 11, fontWeight: '800' }}>
                    {animeResult.nextAnimeTier.label}
                  </Text>
                </View>
              </View>
            )}
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
        <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
          Friend Activity
        </Text>
        {loading ? (
          <ActivityIndicator color={Colors.textMuted} />
        ) : friendPRs.length === 0 ? (
          <View style={{ backgroundColor: Colors.surface, borderRadius: 12, padding: 18, borderWidth: 1, borderColor: Colors.border }}>
            <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Add friends to see their PRs here.</Text>
          </View>
        ) : (
          friendPRs.map((pr, i) => (
            <View key={i} style={{
              backgroundColor: Colors.surface,
              borderRadius: 12,
              padding: 14,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: Colors.border,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 2 }}>{pr.display_name}</Text>
                <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>
                  🏆 {pr.exercise_name} — {pr.weight} {pr.unit_pref}
                </Text>
                {pr.reps > 1 && <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{pr.reps} reps</Text>}
              </View>
              <Text style={{ color: Colors.textMuted, fontSize: 11 }}>{timeAgo(pr.achieved_at)}</Text>
            </View>
          ))
        )}
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
