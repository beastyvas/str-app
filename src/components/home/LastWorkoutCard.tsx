import { StyleSheet, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { AppText, Card } from '@/components/ui';
import { LastWorkout } from '@/hooks/useHomeData';
import { fmtVolume as fmtVolumeUnit } from '@/lib/units';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}

function formatDuration(start: string, end: string) {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

interface LastWorkoutCardProps {
  lastWorkout: LastWorkout;
  unit: 'lbs' | 'kg';
  onPress: () => void;
}

export function LastWorkoutCard({ lastWorkout, unit, onPress }: LastWorkoutCardProps) {
  const stats = [
    { label: 'Duration', value: formatDuration(lastWorkout.started_at, lastWorkout.ended_at) },
    { label: 'Sets', value: String(lastWorkout.sets_count) },
    { label: 'Volume', value: fmtVolumeUnit(lastWorkout.total_volume, unit) },
  ];

  return (
    <View style={styles.wrap}>
      <Card onPress={onPress} padding="lg">
        <View style={styles.headerRow}>
          <View style={styles.titleCol}>
            <AppText variant="overline" style={styles.kicker}>Last Session</AppText>
            <AppText variant="heading" numberOfLines={1}>{lastWorkout.name}</AppText>
          </View>
          <AppText variant="caption">{timeAgo(lastWorkout.started_at)}</AppText>
        </View>
        <View style={styles.statsRow}>
          {stats.map((s, i) => (
            <View key={i}>
              <AppText variant="overline" style={styles.statLabel}>{s.label}</AppText>
              <AppText variant="heading" mono style={styles.statValue}>{s.value}</AppText>
            </View>
          ))}
        </View>
        {lastWorkout.exercises.length > 0 && (
          <AppText variant="caption" color={Colors.textMuted} style={styles.exercises}>
            {lastWorkout.exercises.slice(0, 3).join(' · ')}
            {lastWorkout.exercises.length > 3 ? ` +${lastWorkout.exercises.length - 3}` : ''}
          </AppText>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md + 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  titleCol: { flex: 1, gap: 4 },
  kicker: { fontSize: 10, letterSpacing: 2 },
  statsRow: { flexDirection: 'row', gap: 24 },
  statLabel: { fontSize: 9, letterSpacing: 1.5 },
  statValue: { marginTop: 3 },
  exercises: { marginTop: Spacing.md, lineHeight: 18 },
});
