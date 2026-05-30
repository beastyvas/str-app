import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function WorkoutSummaryScreen() {
  const { data } = useLocalSearchParams<{ data: string }>();
  const router = useRouter();

  let summary = null;
  try { summary = data ? JSON.parse(data) : null; } catch {}

  if (!summary) {
    router.replace('/(tabs)');
    return null;
  }

  const { name, duration, totalSets, totalVolume, prs, exercises } = summary;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
          Workout Complete
        </Text>
        <Text style={{ color: Colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -1, marginBottom: 28 }}>
          {name}
        </Text>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Duration', value: formatDuration(duration) },
            { label: 'Sets', value: totalSets },
            { label: 'Volume', value: `${(totalVolume / 1000).toFixed(1)}k lbs` },
          ].map((stat, i) => (
            <View key={i} style={{
              flex: 1,
              backgroundColor: Colors.surface,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: Colors.border,
              alignItems: 'center',
            }}>
              <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                {stat.label}
              </Text>
              <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* PRs */}
        {prs?.length > 0 && (
          <View style={{
            backgroundColor: Colors.goldDim,
            borderRadius: 14,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: Colors.gold + '40',
          }}>
            <Text style={{ color: Colors.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 }}>
              🏆 NEW PERSONAL RECORDS
            </Text>
            {prs.map((pr: any, i: number) => (
              <Text key={i} style={{ color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 4 }}>
                {pr.exerciseName} — {pr.weight} lbs × {pr.reps}
              </Text>
            ))}
          </View>
        )}

        {/* Exercise Summary */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
          <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
            Exercises
          </Text>
          {exercises?.map((ex: any, i: number) => (
            <View key={i} style={{ marginBottom: 12 }}>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 }}>{ex.name}</Text>
              <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>
                {ex.sets.length} sets · top set {ex.sets[0]?.weight} × {ex.sets[0]?.reps}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
          style={{
            marginTop: 28,
            backgroundColor: Colors.accent,
            borderRadius: 14,
            paddingVertical: 18,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 }}>DONE</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
