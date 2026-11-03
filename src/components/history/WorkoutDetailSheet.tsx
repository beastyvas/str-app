import { useMemo } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText, Button, IconSymbol, SheetModal, StatTile } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { fmtVolume, toDisplay, type WeightUnit } from '@/lib/units';
import { formatDuration, type WorkoutData, type WorkoutSet } from './historyData';

const SHEET_H = Math.round(Dimensions.get('window').height * 0.8);

interface Props {
  workout: WorkoutData | null;
  unit: WeightUnit;
  onClose: () => void;
  onOpenChart: (exercise: string) => void;
  onDelete: (w: WorkoutData) => void;
}

/** One workout: stats, then every exercise with its sets. Tap an exercise for its chart. */
export function WorkoutDetailSheet({ workout, unit, onClose, onOpenChart, onDelete }: Props) {
  const world = useWorld();
  const byExercise = useMemo(() => {
    const acc: Record<string, WorkoutSet[]> = {};
    for (const s of workout?._sets ?? []) {
      const n = s.exercises?.name ?? 'Unknown';
      (acc[n] ??= []).push(s);
    }
    for (const k of Object.keys(acc)) acc[k] = [...acc[k]].sort((a, b) => a.set_number - b.set_number);
    return acc;
  }, [workout]);

  const confirmDelete = () => workout && Alert.alert('Delete workout', `Delete "${workout.name}"? This cannot be undone.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { onDelete(workout); onClose(); } },
  ]);

  return (
    <SheetModal visible={!!workout} onClose={onClose} keyboardAware={false} snapHeight={SHEET_H}>
      {workout && (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <AppText variant="title" numberOfLines={2}>{workout.name}</AppText>
            <AppText variant="label">
              {new Date(workout.started_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </AppText>
          </View>
          <View style={styles.stats}>
            <StatTile label="Duration" value={formatDuration(workout.duration_mins)} />
            <StatTile label="Volume" value={fmtVolume(workout.total_volume, unit)} />
            <StatTile label="Sets" value={workout.sets_count} />
            <StatTile label="PRs" value={workout.pr_count} tint={workout.pr_count ? world.aura : undefined} />
          </View>
          {workout.notes ? <AppText variant="body">{workout.notes}</AppText> : null}

          <View style={styles.list}>
            {Object.entries(byExercise).map(([name, sets], i) => (
              <TouchableOpacity key={name} onPress={() => onOpenChart(name)} style={[styles.ex, i > 0 && styles.divider]} accessibilityLabel={`${name}, open progress chart`}>
                <View style={styles.exHead}>
                  <AppText variant="heading" style={styles.flex} numberOfLines={1}>{name}</AppText>
                  <IconSymbol name="chart" size={14} color={world.aura} />
                </View>
                <AppText variant="label" color={Colors.textSecondary} mono>
                  {sets.map(s => `${s.weight === 0 ? 'BW' : toDisplay(s.weight, unit)}×${s.reps}${s.rpe ? ` @${s.rpe}` : ''}`).join('   ')}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
          <Button label="Delete workout" variant="danger" fullWidth onPress={confirmDelete} />
        </ScrollView>
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.lg, paddingBottom: Spacing.xl },
  head: { gap: 2 },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  list: { backgroundColor: Colors.surface2, borderRadius: Radius.lg, overflow: 'hidden' },
  ex: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: 4, minHeight: 56 },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
});
