import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText, Button } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import type { WorkoutDayData } from '@/hooks/useHomeData';

const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];

interface Props {
  /** Planned session for today from the split; null = nothing planned */
  todaySession: string | null;
  trainedToday: boolean;
  hasSplit: boolean;
  workoutDays: Record<number, WorkoutDayData>;
  onStartWorkout: () => void;
  onSelectDay: (day: WorkoutDayData & { dow: number }) => void;
}

/** "Today": the planned session (or rest day) with Start workout inside, plus the week. */
export function TodayBlock({ todaySession, trainedToday, hasSplit, workoutDays, onStartWorkout, onSelectDay }: Props) {
  const world = useWorld();
  const today = new Date().getDay();
  const title = trainedToday ? 'Trained today' : todaySession ?? (hasSplit ? 'Rest day' : 'Nothing planned');
  const sub = trainedToday
    ? 'Nice. Recovery is training too.'
    : todaySession ? "Today's planned session" : hasSplit ? 'Your split has today off' : 'Pick a template or start empty';

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="label">Today</AppText>
          <AppText variant="title">{title}</AppText>
          <AppText variant="caption">{sub}</AppText>
        </View>
      </View>
      <View style={styles.week}>
        {WEEK.map(dow => {
          const d = workoutDays[dow];
          const isToday = dow === today;
          return (
            <TouchableOpacity
              key={dow}
              disabled={!d}
              onPress={() => d && onSelectDay({ dow, ...d })}
              style={styles.day}
              accessibilityLabel={`${DAY_SHORT[dow]}${d ? `, ${d.name}` : ''}`}
            >
              <View style={[
                styles.mark,
                d && { backgroundColor: world.aura, borderColor: world.aura },
                isToday && !d && { borderColor: world.aura },
              ]} />
              <AppText variant="caption" color={isToday ? Colors.text : Colors.textMuted}>{DAY_SHORT[dow]}</AppText>
            </TouchableOpacity>
          );
        })}
      </View>
      <Button
        label="Start workout"
        size="lg"
        fullWidth
        haptic="medium"
        variant={trainedToday ? 'secondary' : 'primary'}
        onPress={onStartWorkout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start' },
  flex: { flex: 1, gap: 2 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: Spacing.xs, minWidth: 40, minHeight: 44, justifyContent: 'center' },
  mark: { width: 14, height: 14, borderWidth: 1.5, borderColor: Colors.borderLight, transform: [{ rotate: '45deg' }] },
});
