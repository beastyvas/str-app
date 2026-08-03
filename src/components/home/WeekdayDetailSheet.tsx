import { StyleSheet, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppText, SheetModal } from '@/components/ui';
import { SESSION_EMOJI } from '@/lib/sessionType';
import { WorkoutDayData } from '@/hooks/useHomeData';
import { toDisplay } from '@/lib/units';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface WeekdayDetailSheetProps {
  day: (WorkoutDayData & { dow: number }) | null;
  unit: 'lbs' | 'kg';
  onClose: () => void;
}

export function WeekdayDetailSheet({ day, unit, onClose }: WeekdayDetailSheetProps) {
  return (
    <SheetModal visible={!!day} onClose={onClose} keyboardAware={false}>
      {day && (
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <AppText style={styles.emoji}>{SESSION_EMOJI[day.sessionType] ?? '🏋️'}</AppText>
            <View style={styles.headerText}>
              <AppText variant="overline" style={styles.dayLabel}>{DAY_LABELS[day.dow]}</AppText>
              <AppText variant="heading" numberOfLines={1}>{day.name}</AppText>
              <AppText variant="caption" style={styles.meta}>
                {day.durationMins >= 60
                  ? `${Math.floor(day.durationMins / 60)}h ${day.durationMins % 60}m`
                  : `${day.durationMins}m`}
                {' · '}{day.sessionType}
              </AppText>
            </View>
          </View>

          {day.topLifts.length > 0 && (
            <View style={styles.liftsBlock}>
              <AppText variant="overline" style={styles.liftsLabel}>Top Lifts</AppText>
              <View style={styles.chips}>
                {day.topLifts.map((lift, i) => (
                  <View key={i} style={styles.chip}>
                    <AppText variant="caption" color={Colors.text} style={styles.chipName}>{lift.name}</AppText>
                    <AppText variant="micro" style={styles.chipStat}>
                      {toDisplay(lift.weight, unit)} {unit} × {lift.reps}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.md, paddingBottom: Spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md + 2 },
  emoji: { fontSize: 48 },
  headerText: { flex: 1, gap: 2 },
  dayLabel: { fontSize: 10, letterSpacing: 1.5 },
  meta: { marginTop: 1 },
  liftsBlock: { marginTop: Spacing.xs },
  liftsLabel: { fontSize: 10, letterSpacing: 2, marginBottom: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipName: { fontWeight: '700' },
  chipStat: { marginTop: 2 },
});
