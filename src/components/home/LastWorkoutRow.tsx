import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText, IconSymbol } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { classifySessionFromNames } from '@/lib/sessionType';
import type { LastWorkout } from '@/hooks/useHomeData';

/** "Push · Thu · 52 min · 3 PRs" — one row, tap for details. */
export function LastWorkoutRow({ lastWorkout, onPress }: { lastWorkout: LastWorkout; onPress: () => void }) {
  const type = classifySessionFromNames(lastWorkout.exercises) ?? lastWorkout.name;
  const day = new Date(lastWorkout.started_at).toLocaleDateString('en-US', { weekday: 'short' });
  const mins = Math.max(1, Math.round((new Date(lastWorkout.ended_at).getTime() - new Date(lastWorkout.started_at).getTime()) / 60000));
  const parts = [type, day, `${mins} min`];
  if (lastWorkout.prCount > 0) parts.push(`${lastWorkout.prCount} PR${lastWorkout.prCount === 1 ? '' : 's'}`);
  return (
    <TouchableOpacity onPress={onPress} style={styles.row} accessibilityRole="button">
      <View style={styles.flex}>
        <AppText variant="caption">Last workout</AppText>
        <AppText variant="heading" numberOfLines={1}>{parts.join(' · ')}</AppText>
      </View>
      <IconSymbol name="chevronRight" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 60, paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
  },
  flex: { flex: 1, gap: 2, paddingVertical: Spacing.sm },
});
