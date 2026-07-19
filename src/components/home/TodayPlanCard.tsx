import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppText, Card } from '@/components/ui';
import { SESSION_COLORS, SESSION_EMOJI } from '@/lib/sessionType';
import { WorkoutDayData } from '@/hooks/useHomeData';

const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface TodayPlanCardProps {
  /** Planned session for today from the split (null once today is logged) */
  todaySession: string | null;
  workoutDays: Record<number, WorkoutDayData>;
  onStartWorkout: () => void;
  onSelectDay: (day: WorkoutDayData & { dow: number }) => void;
}

/** Today's mission header (when a session is planned) + the 7-day week strip. */
export function TodayPlanCard({ todaySession, workoutDays, onStartWorkout, onSelectDay }: TodayPlanCardProps) {
  if (!todaySession && Object.keys(workoutDays).length === 0) return null;
  const missionColor = todaySession ? (SESSION_COLORS[todaySession] ?? Colors.accent) : null;

  return (
    <View style={styles.wrap}>
      <Card padding="lg" accent={missionColor ?? undefined} style={missionColor ? { borderColor: missionColor + '40' } : undefined}>
        {todaySession && missionColor && (
          <View style={styles.missionRow}>
            <View>
              <AppText variant="overline" style={styles.missionLabel}>Today's Mission</AppText>
              <View style={styles.missionTitleRow}>
                <AppText style={styles.missionEmoji}>{SESSION_EMOJI[todaySession] ?? '🏋️'}</AppText>
                <AppText variant="title" color={missionColor}>{todaySession}</AppText>
              </View>
            </View>
            <TouchableOpacity
              onPress={onStartWorkout}
              style={[styles.goBtn, { backgroundColor: missionColor + '20', borderColor: missionColor + '45' }]}
            >
              <AppText variant="caption" color={missionColor} style={styles.goText}>Let's go →</AppText>
            </TouchableOpacity>
          </View>
        )}

        {!todaySession && (
          <AppText variant="overline" style={styles.weekLabel}>This Week</AppText>
        )}

        <View style={styles.strip}>
          {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
            const dayData = workoutDays[dayIdx];
            const isToday = new Date().getDay() === dayIdx;
            const color = dayData ? (SESSION_COLORS[dayData.sessionType] ?? '#888') : null;
            const isPlanned = isToday && todaySession && !dayData;
            const plannedColor = isPlanned ? (SESSION_COLORS[todaySession!] ?? Colors.accent) : null;
            const displayEmoji = dayData ? (SESSION_EMOJI[dayData.sessionType] ?? '🏋️') : null;

            return (
              <TouchableOpacity
                key={dayIdx}
                style={styles.dayCol}
                disabled={!dayData}
                onPress={() => dayData && onSelectDay({ dow: dayIdx, ...dayData })}
              >
                <View style={[
                  styles.dayCell,
                  {
                    backgroundColor: color
                      ? color + '22'
                      : isPlanned && plannedColor ? plannedColor + '10' : Colors.surface2,
                    borderWidth: isToday ? 1.5 : 1,
                    borderColor: isToday
                      ? (color ?? plannedColor ?? Colors.accent)
                      : (color ? color + '55' : Colors.border),
                  },
                ]}>
                  {displayEmoji ? (
                    <AppText style={styles.dayEmoji}>{displayEmoji}</AppText>
                  ) : isPlanned && plannedColor ? (
                    <View style={[styles.plannedDot, { backgroundColor: plannedColor }]} />
                  ) : null}
                </View>
                <AppText
                  variant="micro"
                  color={isToday ? Colors.text : Colors.textMuted}
                  style={isToday ? styles.dayLabelToday : undefined}
                >
                  {DAY_SHORT[dayIdx]}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md + 2 },
  missionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.md + 2, paddingBottom: Spacing.md + 2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  missionLabel: { marginBottom: 4, fontSize: 10, letterSpacing: 2 },
  missionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  missionEmoji: { fontSize: 20 },
  goBtn: { borderRadius: Radius.md + 2, paddingHorizontal: Spacing.lg, paddingVertical: 10, borderWidth: 1 },
  goText: { fontWeight: '800' },
  weekLabel: { marginBottom: 10, fontSize: 10, letterSpacing: 2 },
  strip: { flexDirection: 'row', gap: 5 },
  dayCol: { flex: 1, alignItems: 'center', gap: 5 },
  dayCell: {
    width: '100%', height: 36, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  dayEmoji: { fontSize: 16 },
  plannedDot: { width: 7, height: 7, borderRadius: 3.5, opacity: 0.4 },
  dayLabelToday: { fontWeight: '800' },
});
