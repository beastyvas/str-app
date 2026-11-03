import { memo, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText } from '@/components/ui';
import { MangaPanel } from '@/components/anime';
import { Colors, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { fmtVolume, type WeightUnit } from '@/lib/units';
import { weekStart, type WorkoutData } from './historyData';

const WEEKS = 12;
// Alpha steps (hex suffix) for intensity — aura at increasing strength
const LEVELS = ['00', '40', '70', 'A8', 'FF'];

/**
 * Hero: the last 12 weeks as a heat strip — one column per week, Mon→Sun
 * down. Aura intensity = that day's volume. Tap a day to open it.
 */
export const HeatStrip = memo(function HeatStrip({ workouts, unit, onSelect }: {
  workouts: WorkoutData[]; unit: WeightUnit; onSelect: (w: WorkoutData) => void;
}) {
  const world = useWorld();
  const { cols, max, total, sessions } = useMemo(() => {
    const start = weekStart(new Date());
    start.setDate(start.getDate() - (WEEKS - 1) * 7);
    const byDay = new Map<string, { volume: number; workout: WorkoutData }>();
    let total = 0;
    let sessions = 0;
    for (const w of workouts) {
      const d = new Date(w.started_at);
      if (d < start) continue;
      const k = d.toDateString();
      const cur = byDay.get(k);
      byDay.set(k, { volume: (cur?.volume ?? 0) + w.total_volume, workout: cur?.workout ?? w });
      total += w.total_volume;
      sessions++;
    }
    const max = Math.max(1, ...[...byDay.values()].map(v => v.volume));
    const cols = Array.from({ length: WEEKS }, (_, c) => Array.from({ length: 7 }, (_, r) => {
      const d = new Date(start);
      d.setDate(start.getDate() + c * 7 + r);
      return { date: d, cell: byDay.get(d.toDateString()) ?? null, future: d > new Date() };
    }));
    return { cols, max, total, sessions };
  }, [workouts]);

  return (
    <MangaPanel motif="header">
      <View style={styles.head}>
        <AppText variant="title">Last 12 weeks</AppText>
        <AppText variant="label">{sessions} sessions · {fmtVolume(total, unit)}</AppText>
      </View>
      <View style={styles.grid}>
        {cols.map((col, c) => (
          <View key={c} style={styles.col}>
            {col.map(({ date, cell, future }, r) => {
              const level = cell ? Math.max(1, Math.ceil((cell.volume / max) * 4)) : 0;
              return (
                <TouchableOpacity
                  key={r}
                  disabled={!cell}
                  onPress={() => cell && onSelect(cell.workout)}
                  hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
                  accessibilityLabel={cell ? `${date.toDateString()}, ${cell.workout.name}` : undefined}
                  style={[
                    styles.cell,
                    { backgroundColor: level ? world.aura + LEVELS[level] : Colors.surface2 },
                    future && styles.future,
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <AppText variant="caption">Less</AppText>
        {LEVELS.slice(1).map(l => <View key={l} style={[styles.key, { backgroundColor: world.aura + l }]} />)}
        <AppText variant="caption">More volume</AppText>
      </View>
    </MangaPanel>
  );
});

const styles = StyleSheet.create({
  head: { gap: 2, marginBottom: Spacing.md },
  grid: { flexDirection: 'row', gap: 4 },
  col: { flex: 1, gap: 4 },
  cell: { aspectRatio: 1, borderRadius: 2 },
  future: { opacity: 0.25 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.md, justifyContent: 'flex-end' },
  key: { width: 10, height: 10, borderRadius: 2 },
});
