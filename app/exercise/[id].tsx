import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors, TierName } from '@/constants/colors';
import { getTierForWeight, TIER_LABELS, TIER_ORDER, STRENGTH_STANDARDS } from '@/constants/strengthStandards';

const SCREEN_WIDTH = Dimensions.get('window').width;

const TIER_COLORS: Record<TierName, string> = {
  beginner: Colors.tiers.beginner,
  bronze: Colors.tiers.bronze,
  silver: Colors.tiers.silver,
  gold: Colors.tiers.gold,
  platinum: Colors.tiers.platinum,
  diamond: Colors.tiers.diamond,
};

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
  const standard = STRENGTH_STANDARDS[exercise.name.toLowerCase()];
  const isBodyweightBased = standard?.type === 'bodyweight_multiplier';

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

        {/* Strength Tier Ladder */}
        {standard && (
          <View style={{
            backgroundColor: Colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: Colors.border,
          }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
              Strength Standards {isBodyweightBased ? `(${bw}lb BW)` : ''}
            </Text>
            {TIER_ORDER.slice(1).reverse().map((tier) => {
              const threshold = standard.thresholds[tier];
              const displayVal = isBodyweightBased
                ? `${(threshold * bw).toFixed(0)} lbs (${threshold}× BW)`
                : `${threshold} lbs`;
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

        {/* Form Cues */}
        {exercise.form_cues && (
          <View style={{
            backgroundColor: Colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: Colors.border,
          }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
              Form Cues
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 14, lineHeight: 22 }}>
              {exercise.form_cues}
            </Text>
          </View>
        )}

        {/* Progress Chart */}
        {chartData.length >= 2 && (
          <View style={{
            backgroundColor: Colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: Colors.border,
            overflow: 'hidden',
          }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
              Top Set Weight — Last {chartData.length} Sessions
            </Text>
            <LineChart
              data={chartData}
              width={SCREEN_WIDTH - 80}
              height={120}
              color={Colors.accent}
              thickness={2}
              dataPointsColor={Colors.accent}
              dataPointsRadius={4}
              startFillColor={Colors.accent}
              endFillColor={Colors.bg}
              startOpacity={0.15}
              endOpacity={0}
              areaChart
              hideAxesAndRules
              hideYAxisText
              hideDataPoints={chartData.length > 6}
              curved
              yAxisLabelWidth={0}
              initialSpacing={8}
              endSpacing={8}
            />
          </View>
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
