import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

interface FriendPR {
  display_name: string;
  exercise_name: string;
  weight: number;
  reps: number;
  achieved_at: string;
  unit_pref: 'lbs' | 'kg';
}

interface LastWorkout {
  id: string;
  name: string;
  started_at: string;
  ended_at: string;
  sets_count: number;
  total_volume: number;
  exercises: string[];
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [prs, setPrs] = useState<FriendPR[]>([]);
  const [lastWorkout, setLastWorkout] = useState<LastWorkout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [prRes, workoutRes] = await Promise.all([
        supabase
          .from('personal_records')
          .select('weight, reps, achieved_at, exercises ( name ), users!inner ( display_name, unit_pref )')
          .neq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .order('achieved_at', { ascending: false })
          .limit(10),
        supabase
          .from('workouts')
          .select('id, name, started_at, ended_at, workout_sets ( weight, reps, exercises ( name ) )')
          .not('ended_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .single(),
      ]);

      if (prRes.data) {
        setPrs(prRes.data.map((pr: any) => ({
          display_name: pr.users.display_name,
          exercise_name: pr.exercises.name,
          weight: pr.weight,
          reps: pr.reps,
          achieved_at: pr.achieved_at,
          unit_pref: pr.users.unit_pref,
        })));
      }

      if (workoutRes.data) {
        const w = workoutRes.data as any;
        const sets = w.workout_sets ?? [];
        const totalVolume = sets.reduce((sum: number, s: any) => sum + s.weight * s.reps, 0);
        const exercises = [...new Set(sets.map((s: any) => s.exercises?.name).filter(Boolean))] as string[];
        setLastWorkout({
          id: w.id,
          name: w.name,
          started_at: w.started_at,
          ended_at: w.ended_at,
          sets_count: sets.length,
          total_volume: totalVolume,
          exercises,
        });
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
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDuration = (start: string, end: string) => {
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const formatVolume = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: Colors.textMuted, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
            {getTimeOfDay()}
          </Text>
          <Text style={{ color: Colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -1, marginTop: 2 }}>
            {profile?.display_name?.split(' ')[0] ?? 'Athlete'}
          </Text>
        </View>

        {/* Start Workout CTA */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/workout')}
          style={{
            backgroundColor: Colors.accent,
            borderRadius: 16,
            padding: 24,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: Colors.text, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4, opacity: 0.8 }}>
            Ready to train?
          </Text>
          <Text style={{ color: Colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>
            Start Workout →
          </Text>
        </TouchableOpacity>

        {/* Last Workout Card */}
        {lastWorkout && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/history')}
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 14,
              padding: 16,
              marginBottom: 24,
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
            <View style={{ flexDirection: 'row', gap: 20 }}>
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Duration</Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 2 }}>
                  {formatDuration(lastWorkout.started_at, lastWorkout.ended_at)}
                </Text>
              </View>
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Sets</Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 2 }}>
                  {lastWorkout.sets_count}
                </Text>
              </View>
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Volume</Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 2 }}>
                  {formatVolume(lastWorkout.total_volume)} lbs
                </Text>
              </View>
            </View>
            {lastWorkout.exercises.length > 0 && (
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 10 }}>
                {lastWorkout.exercises.slice(0, 3).join(' · ')}
                {lastWorkout.exercises.length > 3 ? ` +${lastWorkout.exercises.length - 3}` : ''}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* AI Coach Card */}
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

        {/* Activity Strip — friends' PRs */}
        <View>
          <Text style={{
            color: Colors.textMuted, fontSize: 11,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
          }}>
            Friend Activity
          </Text>

          {loading ? (
            <ActivityIndicator color={Colors.textMuted} style={{ marginTop: 20 }} />
          ) : prs.length === 0 ? (
            <View style={{
              backgroundColor: Colors.surface,
              borderRadius: 12,
              padding: 20,
              borderWidth: 1,
              borderColor: Colors.border,
            }}>
              <Text style={{ color: Colors.textMuted, fontSize: 13 }}>
                Add friends to see their PRs here.
              </Text>
            </View>
          ) : (
            prs.map((pr, i) => (
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
                  <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 2 }}>
                    {pr.display_name}
                  </Text>
                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>
                    🏆 {pr.exercise_name} PR — {pr.weight}{pr.unit_pref}
                  </Text>
                  {pr.reps > 1 && (
                    <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{pr.reps} reps</Text>
                  )}
                </View>
                <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                  {timeAgo(pr.achieved_at)}
                </Text>
              </View>
            ))
          )}
        </View>
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
