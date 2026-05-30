import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { WorkoutRow } from '@/lib/database.types';

interface WorkoutWithSets extends WorkoutRow {
  sets_count: number;
  total_volume: number;
  exercises: string[];
  expanded?: boolean;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<WorkoutWithSets[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSets, setExpandedSets] = useState<Record<string, any[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('workouts')
      .select(`
        *,
        workout_sets ( weight, reps, exercise_id, set_number, rpe, note, logged_at,
          exercises ( name )
        )
      `)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(50);

    if (data) {
      setWorkouts(data.map((w: any) => {
        const sets = w.workout_sets ?? [];
        const totalVolume = sets.reduce((sum: number, s: any) => sum + s.weight * s.reps, 0);
        const exerciseNames = [...new Set(sets.map((s: any) => s.exercises?.name).filter(Boolean))] as string[];
        return {
          ...w,
          sets_count: sets.length,
          total_volume: totalVolume,
          exercises: exerciseNames,
          _sets: sets,
        };
      }));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const toggleExpand = (workout: any) => {
    if (expandedId === workout.id) {
      setExpandedId(null);
    } else {
      setExpandedId(workout.id);
      setExpandedSets(prev => ({ ...prev, [workout.id]: workout._sets }));
    }
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return '—';
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={{ padding: 20, paddingBottom: 8 }}>
        <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -1 }}>
          History
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 40 }}>
        {workouts.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ color: Colors.textMuted, fontSize: 15 }}>No workouts yet. Start lifting.</Text>
          </View>
        ) : (
          workouts.map((workout: any) => (
            <TouchableOpacity
              key={workout.id}
              onPress={() => toggleExpand(workout)}
              style={{
                backgroundColor: Colors.surface,
                borderRadius: 14,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: expandedId === workout.id ? Colors.borderLight : Colors.border,
                overflow: 'hidden',
              }}
            >
              {/* Summary row */}
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 2 }}>
                      {workout.name}
                    </Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                      {formatDate(workout.started_at)} · {formatDuration(workout.started_at, workout.ended_at)}
                    </Text>
                  </View>
                  <Text style={{ color: Colors.textMuted, fontSize: 18 }}>
                    {expandedId === workout.id ? '▲' : '▼'}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 20, marginTop: 12 }}>
                  <View>
                    <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Sets</Text>
                    <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '800' }}>{workout.sets_count}</Text>
                  </View>
                  <View>
                    <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Volume</Text>
                    <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '800' }}>
                      {workout.total_volume >= 1000
                        ? `${(workout.total_volume / 1000).toFixed(1)}k`
                        : workout.total_volume.toLocaleString()} lbs
                    </Text>
                  </View>
                </View>

                <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 8 }}>
                  {workout.exercises.slice(0, 3).join(', ')}{workout.exercises.length > 3 ? ` +${workout.exercises.length - 3} more` : ''}
                </Text>
              </View>

              {/* Expanded set log */}
              {expandedId === workout.id && (
                <View style={{ borderTopWidth: 1, borderTopColor: Colors.border }}>
                  {Object.entries(
                    (expandedSets[workout.id] ?? []).reduce<Record<string, any[]>>((acc, s: any) => {
                      const name = s.exercises?.name ?? 'Unknown';
                      if (!acc[name]) acc[name] = [];
                      acc[name].push(s);
                      return acc;
                    }, {})
                  ).map(([exName, sets]) => (
                    <View key={exName} style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                      <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 }}>
                        {exName.toUpperCase()}
                      </Text>
                      {(sets as any[]).map((s: any, i: number) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={{ color: Colors.textMuted, fontSize: 12, width: 24 }}>
                            {s.set_number}
                          </Text>
                          <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>
                            {s.weight} × {s.reps}
                          </Text>
                          {s.rpe && (
                            <Text style={{ color: Colors.textMuted, fontSize: 12, marginRight: 10 }}>
                              RPE {s.rpe}
                            </Text>
                          )}
                          {s.note && (
                            <Text style={{ color: Colors.textSecondary, fontSize: 12, flex: 1, fontStyle: 'italic' }}>
                              "{s.note}"
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
