import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

interface WorkoutSet {
  weight: number;
  reps: number;
  rpe?: number;
  note?: string;
  set_number: number;
  exercises?: { name: string; muscle_group?: string };
}

interface WorkoutData {
  id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
  notes?: string;
  _sets: WorkoutSet[];
  sets_count: number;
  total_volume: number;
  exercises: string[];
  muscle_groups: string[];
  top_set: string;
  duration_mins: number;
}

interface Insight {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

// Muscle group color tags
const MUSCLE_COLORS: Record<string, string> = {
  'Chest': '#E91E8C',
  'Shoulders': '#9B59B6',
  'Triceps': '#8E44AD',
  'Biceps': '#3498DB',
  'Mid-Upper Back': '#1ABC9C',
  'Lats': '#16A085',
  'Quads': '#E67E22',
  'Hamstrings': '#D35400',
  'Glutes': '#E74C3C',
  'Core': '#F39C12',
  'Calves': '#95A5A6',
  'Forearms': '#7F8C8D',
  'Overall': '#ECF0F1',
};

function getMuscleColor(mg: string): string {
  return MUSCLE_COLORS[mg] ?? Colors.textMuted;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / 86400000);
}

function computeInsights(workouts: WorkoutData[]): Insight[] {
  if (workouts.length === 0) return [];

  const now = new Date();
  const insights: Insight[] = [];

  // ── Volume this week vs last ──────────────────────────────────────────────
  const thisWeekVol = workouts
    .filter(w => daysBetween(new Date(w.started_at), now) < 7)
    .reduce((s, w) => s + w.total_volume, 0);
  const lastWeekVol = workouts
    .filter(w => { const d = daysBetween(new Date(w.started_at), now); return d >= 7 && d < 14; })
    .reduce((s, w) => s + w.total_volume, 0);

  if (lastWeekVol > 0 && thisWeekVol > 0) {
    const pct = Math.round(((thisWeekVol - lastWeekVol) / lastWeekVol) * 100);
    insights.push({
      label: 'Volume trend',
      value: `${pct >= 0 ? '+' : ''}${pct}%`,
      sub: 'vs last week',
      color: pct >= 0 ? Colors.success : Colors.danger,
    });
  }

  // ── Streak ────────────────────────────────────────────────────────────────
  const daySet = new Set(workouts.map(w =>
    new Date(w.started_at).toDateString()
  ));
  let streak = 0;
  for (let d = 0; d < 60; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    if (daySet.has(day.toDateString())) streak++;
    else if (d > 0) break;
  }
  if (streak > 0) {
    insights.push({
      label: 'Current streak',
      value: `${streak}d`,
      sub: streak >= 7 ? '🔥 Keep it going' : 'consecutive days',
      color: Colors.gold,
    });
  }

  // ── Most trained muscle this month ───────────────────────────────────────
  const muscleCount: Record<string, number> = {};
  workouts
    .filter(w => daysBetween(new Date(w.started_at), now) < 30)
    .forEach(w => w.muscle_groups.forEach(m => { muscleCount[m] = (muscleCount[m] ?? 0) + 1; }));
  const topMuscle = Object.entries(muscleCount).sort((a, b) => b[1] - a[1])[0];
  if (topMuscle) {
    insights.push({
      label: 'Most trained',
      value: topMuscle[0],
      sub: `${topMuscle[1]}x this month`,
      color: getMuscleColor(topMuscle[0]),
    });
  }

  // ── Neglected muscle ─────────────────────────────────────────────────────
  const muscleLastDate: Record<string, Date> = {};
  workouts.forEach(w => {
    const d = new Date(w.started_at);
    w.muscle_groups.forEach(m => {
      if (!muscleLastDate[m] || d > muscleLastDate[m]) muscleLastDate[m] = d;
    });
  });
  const neglected = Object.entries(muscleLastDate)
    .filter(([, d]) => daysBetween(d, now) >= 7)
    .sort((a, b) => daysBetween(b[1], now) - daysBetween(a[1], now))[0];
  if (neglected) {
    insights.push({
      label: 'Neglected',
      value: neglected[0],
      sub: `${daysBetween(neglected[1], now)}d since last hit`,
      color: Colors.danger,
    });
  }

  // ── Average session duration ──────────────────────────────────────────────
  const validDurations = workouts.filter(w => w.duration_mins > 0 && w.duration_mins < 240);
  if (validDurations.length >= 3) {
    const avg = Math.round(validDurations.reduce((s, w) => s + w.duration_mins, 0) / validDurations.length);
    insights.push({
      label: 'Avg session',
      value: `${avg}m`,
      sub: 'duration',
      color: Colors.textSecondary,
    });
  }

  // ── Best day of week ──────────────────────────────────────────────────────
  const dayVol: Record<number, number> = {};
  workouts.forEach(w => {
    const d = new Date(w.started_at).getDay();
    dayVol[d] = (dayVol[d] ?? 0) + w.total_volume;
  });
  const bestDay = Object.entries(dayVol).sort((a, b) => b[1] - a[1])[0];
  if (bestDay) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    insights.push({
      label: 'Strongest day',
      value: days[parseInt(bestDay[0])],
      sub: 'by total volume',
      color: Colors.accent,
    });
  }

  return insights;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<WorkoutData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('workouts')
      .select(`*, workout_sets(weight, reps, set_number, rpe, note, logged_at, exercises(name, muscle_group))`)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(60);

    if (data) {
      const mapped: WorkoutData[] = data.map((w: any) => {
        const sets: WorkoutSet[] = w.workout_sets ?? [];
        const totalVolume = sets.reduce((s: number, x: any) => s + x.weight * x.reps, 0);
        const exerciseNames = [...new Set(sets.map((s: any) => s.exercises?.name).filter(Boolean))] as string[];
        const muscleGroups = [...new Set(sets.map((s: any) => s.exercises?.muscle_group).filter(Boolean))] as string[];
        const durMins = w.ended_at ? Math.round((new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000) : 0;

        // Find top set by estimated 1RM
        const topSet = sets.reduce((best: any, s: any) => {
          const e1rm = s.weight * (1 + s.reps / 30);
          const bestE1rm = best ? best.weight * (1 + best.reps / 30) : 0;
          return e1rm > bestE1rm ? s : best;
        }, null);

        return {
          ...w,
          _sets: sets,
          sets_count: sets.length,
          total_volume: totalVolume,
          exercises: exerciseNames,
          muscle_groups: muscleGroups,
          top_set: topSet ? `${topSet.exercises?.name} ${topSet.weight}×${topSet.reps}` : '',
          duration_mins: durMins,
        };
      });

      setWorkouts(mapped);
      setInsights(computeInsights(mapped));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatDuration = (mins: number) => {
    if (!mins) return '—';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const formatVolume = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  const thisMonthWorkouts = workouts.filter(w => daysBetween(new Date(w.started_at), new Date()) < 30).length;
  const thisMonthVolume = workouts
    .filter(w => daysBetween(new Date(w.started_at), new Date()) < 30)
    .reduce((s, w) => s + w.total_volume, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
          <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -1 }}>
            History
          </Text>
        </View>

        {/* Stats strip */}
        {workouts.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 }}>
            {[
              { label: 'This Month', value: String(thisMonthWorkouts), sub: 'sessions' },
              { label: 'Volume', value: formatVolume(thisMonthVolume), sub: 'lbs total' },
              { label: 'All Time', value: String(workouts.length), sub: 'workouts' },
            ].map((s, i) => (
              <View key={i} style={{
                flex: 1, backgroundColor: Colors.surface, borderRadius: 12,
                padding: 12, alignItems: 'center',
                borderWidth: 1, borderColor: Colors.border,
              }}>
                <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
                  {s.label}
                </Text>
                <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 }}>{s.value}</Text>
                <Text style={{ color: Colors.textMuted, fontSize: 10, marginTop: 2 }}>{s.sub}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Insight cards — horizontal scroll */}
        {insights.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{
              color: Colors.textMuted, fontSize: 10, letterSpacing: 2,
              textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 10,
            }}>
              Insights
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
            >
              {insights.map((ins, i) => (
                <View key={i} style={{
                  backgroundColor: Colors.surface,
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: (ins.color ?? Colors.border) + '40',
                  borderLeftWidth: 3,
                  borderLeftColor: ins.color ?? Colors.border,
                  minWidth: 130,
                }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 10, marginBottom: 4 }}>
                    {ins.label}
                  </Text>
                  <Text style={{ color: ins.color ?? Colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -1 }}>
                    {ins.value}
                  </Text>
                  {ins.sub && (
                    <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 3 }}>
                      {ins.sub}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Workout list */}
        <View style={{ paddingHorizontal: 20 }}>
          {workouts.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ color: Colors.textMuted, fontSize: 15 }}>No workouts yet. Start lifting.</Text>
            </View>
          ) : (
            workouts.map(workout => {
              const isExpanded = expandedId === workout.id;
              // Group sets by exercise
              const byExercise = workout._sets.reduce<Record<string, { sets: WorkoutSet[], muscleGroup?: string }>>((acc, s: any) => {
                const name = s.exercises?.name ?? 'Unknown';
                if (!acc[name]) acc[name] = { sets: [], muscleGroup: s.exercises?.muscle_group };
                acc[name].sets.push(s);
                return acc;
              }, {});

              return (
                <TouchableOpacity
                  key={workout.id}
                  onPress={() => setExpandedId(isExpanded ? null : workout.id)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: Colors.surface,
                    borderRadius: 16,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: isExpanded ? Colors.accent + '40' : Colors.border,
                    overflow: 'hidden',
                  }}
                >
                  {/* Workout header */}
                  <View style={{ padding: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginBottom: 2 }}>
                          {workout.name}
                        </Text>
                        <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                          {formatDate(workout.started_at)} · {formatDuration(workout.duration_mins)}
                        </Text>
                      </View>
                      <Text style={{ color: isExpanded ? Colors.accent : Colors.textMuted, fontSize: 16 }}>
                        {isExpanded ? '▲' : '▼'}
                      </Text>
                    </View>

                    {/* Stats row */}
                    <View style={{ flexDirection: 'row', gap: 20, marginBottom: 10 }}>
                      {[
                        { label: 'Sets', value: String(workout.sets_count) },
                        { label: 'Volume', value: `${formatVolume(workout.total_volume)} lbs` },
                        { label: 'Exercises', value: String(workout.exercises.length) },
                      ].map((s, i) => (
                        <View key={i}>
                          <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>{s.label}</Text>
                          <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800', marginTop: 2 }}>{s.value}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Muscle group tags */}
                    {workout.muscle_groups.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                        {workout.muscle_groups.slice(0, 5).map((mg, i) => (
                          <View key={i} style={{
                            paddingHorizontal: 8, paddingVertical: 3,
                            borderRadius: 6,
                            backgroundColor: getMuscleColor(mg) + '18',
                            borderWidth: 1,
                            borderColor: getMuscleColor(mg) + '40',
                          }}>
                            <Text style={{ color: getMuscleColor(mg), fontSize: 10, fontWeight: '700' }}>
                              {mg}
                            </Text>
                          </View>
                        ))}
                        {workout.muscle_groups.length > 5 && (
                          <Text style={{ color: Colors.textMuted, fontSize: 10, marginTop: 3 }}>
                            +{workout.muscle_groups.length - 5}
                          </Text>
                        )}
                      </View>
                    )}

                    {/* Top set */}
                    {workout.top_set && !isExpanded && (
                      <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>
                        Top set: {workout.top_set}
                      </Text>
                    )}
                  </View>

                  {/* Expanded set log */}
                  {isExpanded && (
                    <View style={{ borderTopWidth: 1, borderTopColor: Colors.border }}>
                      {Object.entries(byExercise).map(([exName, { sets, muscleGroup }], ei) => {
                        const color = getMuscleColor(muscleGroup ?? '');
                        const topSet = [...sets].sort((a, b) => b.weight * b.reps - a.weight * a.reps)[0];
                        return (
                          <View key={ei} style={{
                            paddingHorizontal: 16, paddingVertical: 12,
                            borderBottomWidth: ei < Object.keys(byExercise).length - 1 ? 1 : 0,
                            borderBottomColor: Colors.border,
                          }}>
                            {/* Exercise header */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <View style={{
                                width: 4, height: 16, borderRadius: 2,
                                backgroundColor: color,
                              }} />
                              <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700', flex: 1 }}>
                                {exName}
                              </Text>
                              <TouchableOpacity
                                onPress={() => {
                                  // Navigate to exercise detail
                                }}
                              >
                                <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                                  {sets.length} set{sets.length !== 1 ? 's' : ''}
                                </Text>
                              </TouchableOpacity>
                            </View>

                            {/* Sets */}
                            {sets.sort((a, b) => a.set_number - b.set_number).map((s, si) => (
                              <View key={si} style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginBottom: 4,
                                paddingLeft: 12,
                                gap: 8,
                              }}>
                                <Text style={{ color: Colors.textMuted, fontSize: 11, width: 18 }}>
                                  {s.set_number}
                                </Text>
                                <Text style={{
                                  color: Colors.text, fontSize: 14, fontWeight: '700',
                                  flex: 1,
                                }}>
                                  {s.weight === 0 ? 'BW' : s.weight} × {s.reps}
                                </Text>
                                {s.rpe && (
                                  <View style={{
                                    backgroundColor: Colors.surface2,
                                    borderRadius: 4,
                                    paddingHorizontal: 5,
                                    paddingVertical: 1,
                                  }}>
                                    <Text style={{ color: Colors.textMuted, fontSize: 10, fontWeight: '700' }}>
                                      RPE {s.rpe}
                                    </Text>
                                  </View>
                                )}
                                {s.note && (
                                  <Text style={{
                                    color: Colors.textSecondary, fontSize: 11,
                                    fontStyle: 'italic', flex: 1,
                                  }} numberOfLines={1}>
                                    "{s.note}"
                                  </Text>
                                )}
                              </View>
                            ))}
                          </View>
                        );
                      })}

                      {/* Workout notes */}
                      {workout.notes && (
                        <View style={{
                          padding: 14, backgroundColor: Colors.surface2,
                          margin: 12, borderRadius: 10,
                        }}>
                          <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                            Session notes
                          </Text>
                          <Text style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
                            {workout.notes}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
