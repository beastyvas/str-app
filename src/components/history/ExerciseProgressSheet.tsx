import { useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { AppText, SheetModal, StatTile } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { fmtVolume, toDisplay, type WeightUnit } from '@/lib/units';
import type { WorkoutData } from './historyData';

type Mode = 'Max weight' | 'Est. 1RM' | 'Volume';
const MODES: Mode[] = ['Max weight', 'Est. 1RM', 'Volume'];
const SCREEN_W = Dimensions.get('window').width;
const SHEET_H = Math.round(Dimensions.get('window').height * 0.85);

/** Per-exercise progress over time: max weight, estimated 1RM, or volume. */
export function ExerciseProgressSheet({ exercise, workouts, unit, onClose }: {
  exercise: string | null; workouts: WorkoutData[]; unit: WeightUnit; onClose: () => void;
}) {
  const world = useWorld();
  const [mode, setMode] = useState<Mode>('Max weight');

  const sessions = useMemo(() => {
    const out: { date: Date; max: number; e1rm: number; volume: number; sets: number }[] = [];
    for (const w of workouts) {
      const sets = w._sets.filter(s => s.exercises?.name === exercise);
      if (!sets.length) continue;
      out.push({
        date: new Date(w.started_at),
        max: Math.max(...sets.map(s => s.weight)),
        e1rm: Math.max(...sets.map(s => s.weight * (1 + s.reps / 30))),
        volume: sets.reduce((n, s) => n + s.weight * s.reps, 0),
        sets: sets.length,
      });
    }
    return out.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [exercise, workouts]);

  const val = (s: typeof sessions[number]) => (mode === 'Max weight' ? s.max : mode === 'Est. 1RM' ? s.e1rm : s.volume);
  const values = sessions.map(val);
  const best = values.length ? Math.max(...values) : 0;
  const fmt = (v: number) => (mode === 'Volume' ? fmtVolume(v, unit) : `${Math.round(toDisplay(v, unit))} ${unit}`);

  const W = SCREEN_W - Spacing.xl * 2;
  const H = 180;
  const pad = { l: 40, r: 12, t: 16, b: 28 };
  const lo = values.length ? Math.min(...values) : 0;
  const range = best - lo;
  const x = (i: number) => pad.l + (values.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (values.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (H - pad.t - pad.b) - (range === 0 ? (H - pad.t - pad.b) / 2 : ((v - lo) / range) * (H - pad.t - pad.b));

  return (
    <SheetModal visible={!!exercise} onClose={onClose} keyboardAware={false} snapHeight={SHEET_H}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <AppText variant="title" numberOfLines={1}>{exercise}</AppText>
        <View style={styles.modes}>
          {MODES.map(m => (
            <TouchableOpacity key={m} onPress={() => setMode(m)} style={[styles.mode, mode === m && { borderColor: world.aura, backgroundColor: world.aura + '1F' }]}>
              <AppText variant="label" color={mode === m ? world.aura : Colors.textSecondary}>{m}</AppText>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.chart}>
          {values.length === 0 ? (
            <AppText variant="body" style={styles.empty}>No data logged yet</AppText>
          ) : (
            <Svg width={W} height={H}>
              {[lo, (lo + best) / 2, best].map((v, i) => (
                <Line key={`g${i}`} x1={pad.l} y1={y(v)} x2={W - pad.r} y2={y(v)} stroke={Colors.border} strokeDasharray="4,4" />
              ))}
              {[lo, (lo + best) / 2, best].map((v, i) => (
                <SvgText key={`y${i}`} x={pad.l - 6} y={y(v) + 4} fontSize={10} fill={Colors.textMuted} textAnchor="end" fontFamily={Fonts.hud}>
                  {mode === 'Volume' ? `${Math.round(v / 1000)}k` : Math.round(toDisplay(v, unit))}
                </SvgText>
              ))}
              {sessions.map((s, i) => (i % (sessions.length > 6 ? 2 : 1) === 0 ? (
                <SvgText key={`x${i}`} x={x(i)} y={H - 6} fontSize={9} fill={Colors.textMuted} textAnchor="middle" fontFamily={Fonts.hud}>
                  {`${s.date.getMonth() + 1}/${s.date.getDate()}`}
                </SvgText>
              ) : null))}
              {values.length > 1 && (
                <Polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={world.aura} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              )}
              {values.map((v, i) => (
                <Circle key={`c${i}`} cx={x(i)} cy={y(v)} r={v === best ? 6 : 4} fill={v === best ? Colors.paper : world.aura} stroke={Colors.bg} strokeWidth={1.5} />
              ))}
            </Svg>
          )}
        </View>

        <View style={styles.stats}>
          <StatTile label="Best" value={fmt(best)} tint={world.aura} />
          <StatTile label="Sessions" value={sessions.length} />
          <StatTile label="Sets" value={sessions.reduce((n, s) => n + s.sets, 0)} />
        </View>

        <View style={styles.list}>
          {[...sessions].reverse().map((s, i) => (
            <View key={i} style={[styles.row, i > 0 && styles.divider]}>
              <AppText variant="label" style={styles.flex}>{s.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</AppText>
              <AppText variant="stat" style={styles.rowVal}>{fmt(val(s))}</AppText>
              <AppText variant="caption">{s.sets} sets</AppText>
            </View>
          ))}
        </View>
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.lg, paddingBottom: Spacing.xl },
  modes: { flexDirection: 'row', gap: Spacing.sm },
  mode: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  chart: { backgroundColor: Colors.surface2, borderRadius: Radius.lg, minHeight: 180, justifyContent: 'center' },
  empty: { textAlign: 'center' },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  list: { backgroundColor: Colors.surface2, borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 48, paddingHorizontal: Spacing.lg },
  rowVal: { fontSize: 16 },
  flex: { flex: 1 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
});
