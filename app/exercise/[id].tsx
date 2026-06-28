import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors, TierName } from '@/constants/colors';
import { getTierForWeight, TIER_LABELS, TIER_ORDER, getScaledThresholds } from '@/constants/strengthStandards';
import { MuscleMap } from '@/components/MuscleMap';
import { ExerciseAnimation } from '@/components/ExerciseAnimation';

const SCREEN_WIDTH = Dimensions.get('window').width;

const TIER_COLORS: Record<TierName, string> = {
  beginner: Colors.tiers.beginner,
  bronze: Colors.tiers.bronze,
  silver: Colors.tiers.silver,
  gold: Colors.tiers.gold,
  platinum: Colors.tiers.platinum,
  diamond: Colors.tiers.diamond,
};

function WeightChart({ data }: { data: { value: number }[] }) {
  const chartWidth = SCREEN_WIDTH - 72;
  const chartHeight = 80;
  const min = Math.min(...data.map(d => d.value));
  const max = Math.max(...data.map(d => d.value));
  const range = max - min || 1;
  const pointSpacing = chartWidth / (data.length - 1);

  return (
    <View style={{
      backgroundColor: Colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: Colors.border,
    }}>
      <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
        Top Set — Last {data.length} Sessions
      </Text>
      <View style={{ height: chartHeight + 24, position: 'relative' }}>
        {/* Bars */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartHeight, gap: 0 }}>
          {data.map((d, i) => {
            const heightPct = (d.value - min) / range;
            const barH = Math.max(4, heightPct * chartHeight);
            const isLast = i === data.length - 1;
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                <View style={{
                  width: Math.max(6, chartWidth / data.length - 4),
                  height: barH,
                  backgroundColor: isLast ? Colors.accent : Colors.accent + '50',
                  borderRadius: 4,
                }} />
              </View>
            );
          })}
        </View>
        {/* Labels: first, last */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ color: Colors.textMuted, fontSize: 10 }}>{data[0].value} lbs</Text>
          <Text style={{ color: Colors.accent, fontSize: 11, fontWeight: '700' }}>{data[data.length - 1].value} lbs</Text>
        </View>
      </View>
    </View>
  );
}

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [exercise, setExercise] = useState<any>(null);
  const [pr, setPr] = useState<any>(null);
  const [recentSets, setRecentSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('exercises').select('*').eq('id', id).single(),
      supabase.from('personal_records').select('*').eq('exercise_id', id).single(),
      supabase.from('workout_sets')
        .select('*, workouts!inner(started_at, name)')
        .eq('exercise_id', id)
        .order('logged_at', { ascending: false })
        .limit(30),
    ]).then(([{ data: ex }, { data: prData }, { data: sets }]) => {
      setExercise(ex);
      setPr(prData);
      setRecentSets(sets ?? []);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  if (!exercise) return null;

  const bw = profile?.bodyweight_lbs ?? 185;
  const prWeight = pr?.weight ?? 0;
  const currentTier = getTierForWeight(exercise.name, prWeight, bw);
  // Strength standards exist only for the SBD lifts; thresholds are absolute lbs
  // scaled to the user's bodyweight via the competition-data lookup.
  const SBD_LIFT_MAP: Record<string, 'squat' | 'bench' | 'deadlift'> = {
    'barbell back squats': 'squat',
    'barbell bench press': 'bench',
    'deadlifts': 'deadlift',
  };
  const sbdLift = SBD_LIFT_MAP[exercise.name.toLowerCase()];
  const sbdGender: 'male' | 'female' = profile?.gender === 'female' ? 'female' : 'male';
  // 24-step threshold table → entry weight for each rank is index rank*4
  const rankThresholds = sbdLift ? getScaledThresholds(sbdLift, bw, sbdGender) : null;

  // Group recent sets by workout session
  const byWorkout = recentSets.reduce<Record<string, any[]>>((acc, s) => {
    const key = s.workouts?.name ?? s.workout_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  // Build chart data — max weight per session, chronological
  const chartData = Object.entries(byWorkout)
    .map(([name, sets]) => ({
      name,
      date: sets[0]?.workouts?.started_at ?? '',
      maxWeight: Math.max(...(sets as any[]).map((s: any) => s.weight)),
    }))
    .filter(d => d.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-10)
    .map(d => ({ value: d.maxWeight }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: Colors.accent, fontSize: 24 }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>
              {exercise.name}
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>
              {exercise.muscle_group}{exercise.secondary_muscle ? ` · ${exercise.secondary_muscle}` : ''}
            </Text>
          </View>
        </View>

        {/* PR + Current Tier */}
        {pr && (
          <View style={{
            backgroundColor: Colors.surface,
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: TIER_COLORS[currentTier] + '60',
          }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
              Personal Record
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ color: Colors.gold, fontSize: 42, fontWeight: '900', letterSpacing: -2 }}>
                {pr.weight}
              </Text>
              <Text style={{ color: Colors.textSecondary, fontSize: 16, fontWeight: '600', marginBottom: 6 }}>
                lbs × {pr.reps}
              </Text>
            </View>
            <View style={{
              alignSelf: 'flex-start',
              backgroundColor: TIER_COLORS[currentTier] + '20',
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 4,
              marginTop: 4,
            }}>
              <Text style={{ color: TIER_COLORS[currentTier], fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>
                {TIER_LABELS[currentTier].toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        {/* Strength Tier Ladder — SBD lifts only */}
        {rankThresholds && (
          <View style={{
            backgroundColor: Colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: Colors.border,
          }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
              Strength Standards (at {bw} lbs)
            </Text>
            {[...TIER_ORDER].reverse().map((tier) => {
              const rankIndex = TIER_ORDER.indexOf(tier);
              const threshold = rankThresholds[rankIndex * 4];
              const displayVal = `${threshold} lbs`;
              const isCurrentOrBelow = TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(currentTier);
              return (
                <View key={tier} style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.border,
                  opacity: isCurrentOrBelow ? 1 : 0.4,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{
                      width: 8, height: 8, borderRadius: 4,
                      backgroundColor: isCurrentOrBelow ? TIER_COLORS[tier] : Colors.textMuted,
                    }} />
                    <Text style={{ color: TIER_COLORS[tier], fontWeight: '700', fontSize: 13 }}>
                      {TIER_LABELS[tier]}
                    </Text>
                  </View>
                  <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>{displayVal}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Animated Exercise Demo */}
        <View style={{
          backgroundColor: Colors.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: Colors.border,
          alignItems: 'center',
        }}>
          <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14, alignSelf: 'flex-start' }}>
            Movement Demo
          </Text>
          <ExerciseAnimation
            exerciseName={exercise.name}
            muscleGroup={exercise.muscle_group}
            equipmentType={exercise.equipment_type}
          />
        </View>

        {/* Muscle Map */}
        <View style={{
          backgroundColor: Colors.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: Colors.border,
          alignItems: 'center',
        }}>
          <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14, alignSelf: 'flex-start' }}>
            Muscles Targeted
          </Text>
          <MuscleMap
            primaryMuscle={exercise.muscle_group}
            secondaryMuscle={exercise.secondary_muscle}
          />
        </View>

        {/* Form Cues — formatted as numbered steps */}
        {exercise.form_cues && (
          <View style={{
            backgroundColor: Colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: Colors.border,
          }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
              How To Do It
            </Text>
            {exercise.form_cues.split('. ').filter((c: string) => c.trim()).map((cue: string, i: number) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: Colors.accent + '20',
                  borderWidth: 1,
                  borderColor: Colors.accent + '40',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}>
                  <Text style={{ color: Colors.accent, fontSize: 10, fontWeight: '800' }}>{i + 1}</Text>
                </View>
                <Text style={{ color: Colors.textSecondary, fontSize: 14, lineHeight: 22, flex: 1 }}>
                  {cue.trim().replace(/\.$/, '')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Progress Chart */}
        {chartData.length >= 2 && (
          <WeightChart data={chartData} />
        )}

        {/* Recent History */}
        {Object.keys(byWorkout).length > 0 && (
          <View style={{
            backgroundColor: Colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: Colors.border,
          }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
              Recent Sessions
            </Text>
            {Object.entries(byWorkout).slice(0, 5).map(([wName, sets], i) => (
              <View key={i} style={{ marginBottom: 16 }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{wName}</Text>
                {(sets as any[]).map((s: any, j: number) => (
                  <View key={j} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                    <Text style={{ color: Colors.textMuted, fontSize: 12, width: 20 }}>{s.set_number}</Text>
                    <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>
                      {s.weight} × {s.reps}
                    </Text>
                    {s.rpe && <Text style={{ color: Colors.textMuted, fontSize: 12 }}>RPE {s.rpe}</Text>}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
