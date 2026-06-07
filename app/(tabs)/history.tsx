import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, Dimensions, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Circle, Line, Text as SvgText, Path } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { useAuth } from '@/hooks/useAuth';

const SCREEN_W = Dimensions.get('window').width;

interface WorkoutSet {
  weight: number;
  reps: number;
  rpe?: number;
  note?: string;
  set_number: number;
  exercises?: { name: string; muscle_group?: string };
}

interface WorkoutData {
  id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
  notes?: string;
  _sets: WorkoutSet[];
  sets_count: number;
  total_volume: number;
  exercises: string[];
  muscle_groups: string[];
  top_set: string;
  duration_mins: number;
}

interface Insight {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

// ─── Muscle group color tags ───────────────────────────────────────────────
const MUSCLE_COLORS: Record<string, string> = {
  'Chest': '#E91E8C',
  'Shoulders': '#9B59B6',
  'Triceps': '#8E44AD',
  'Biceps': '#3498DB',
  'Mid-Upper Back': '#1ABC9C',
  'Lats': '#16A085',
  'Quads': '#E67E22',
  'Hamstrings': '#D35400',
  'Glutes': '#E74C3C',
  'Core': '#F39C12',
  'Calves': '#95A5A6',
  'Forearms': '#7F8C8D',
  'Overall': '#ECF0F1',
};

function getMuscleColor(mg: string): string {
  return MUSCLE_COLORS[mg] ?? Colors.textMuted;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / 86400000);
}

function computeInsights(workouts: WorkoutData[]): Insight[] {
  if (workouts.length === 0) return [];
  const now = new Date();
  const insights: Insight[] = [];

  const thisWeekVol = workouts
    .filter(w => daysBetween(new Date(w.started_at), now) < 7)
    .reduce((s, w) => s + w.total_volume, 0);
  const lastWeekVol = workouts
    .filter(w => { const d = daysBetween(new Date(w.started_at), now); return d >= 7 && d < 14; })
    .reduce((s, w) => s + w.total_volume, 0);
  if (lastWeekVol > 0 && thisWeekVol > 0) {
    const pct = Math.round(((thisWeekVol - lastWeekVol) / lastWeekVol) * 100);
    insights.push({ label: 'Volume trend', value: `${pct >= 0 ? '+' : ''}${pct}%`, sub: 'vs last week', color: pct >= 0 ? Colors.success : Colors.danger });
  }

  const daySet = new Set(workouts.map(w => new Date(w.started_at).toDateString()));
  let streak = 0;
  for (let d = 0; d < 60; d++) {
    const day = new Date(now); day.setDate(now.getDate() - d);
    if (daySet.has(day.toDateString())) streak++;
    else if (d > 0) break;
  }
  if (streak > 0) insights.push({ label: 'Current streak', value: `${streak}d`, sub: streak >= 7 ? '🔥 Keep it going' : 'consecutive days', color: Colors.gold });

  const muscleCount: Record<string, number> = {};
  workouts.filter(w => daysBetween(new Date(w.started_at), now) < 30)
    .forEach(w => w.muscle_groups.forEach(m => { muscleCount[m] = (muscleCount[m] ?? 0) + 1; }));
  const topMuscle = Object.entries(muscleCount).sort((a, b) => b[1] - a[1])[0];
  if (topMuscle) insights.push({ label: 'Most trained', value: topMuscle[0], sub: `${topMuscle[1]}x this month`, color: getMuscleColor(topMuscle[0]) });

  const muscleLastDate: Record<string, Date> = {};
  workouts.forEach(w => { const d = new Date(w.started_at); w.muscle_groups.forEach(m => { if (!muscleLastDate[m] || d > muscleLastDate[m]) muscleLastDate[m] = d; }); });
  const neglected = Object.entries(muscleLastDate).filter(([, d]) => daysBetween(d, now) >= 7).sort((a, b) => daysBetween(b[1], now) - daysBetween(a[1], now))[0];
  if (neglected) insights.push({ label: 'Neglected', value: neglected[0], sub: `${daysBetween(neglected[1], now)}d since last hit`, color: Colors.danger });

  const validDurations = workouts.filter(w => w.duration_mins > 0 && w.duration_mins < 240);
  if (validDurations.length >= 3) {
    const avg = Math.round(validDurations.reduce((s, w) => s + w.duration_mins, 0) / validDurations.length);
    insights.push({ label: 'Avg session', value: `${avg}m`, sub: 'duration', color: Colors.textSecondary });
  }

  const dayVol: Record<number, number> = {};
  workouts.forEach(w => { const d = new Date(w.started_at).getDay(); dayVol[d] = (dayVol[d] ?? 0) + w.total_volume; });
  const bestDay = Object.entries(dayVol).sort((a, b) => b[1] - a[1])[0];
  if (bestDay) { const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; insights.push({ label: 'Strongest day', value: days[parseInt(bestDay[0])], sub: 'by total volume', color: Colors.accent }); }

  return insights;
}

// ─── WorkoutCalendar ───────────────────────────────────────────────────────
function WorkoutCalendar({
  workouts,
  calendarDate,
  setCalendarDate,
  onSelectWorkout,
}: {
  workouts: WorkoutData[];
  calendarDate: Date;
  setCalendarDate: (d: Date) => void;
  onSelectWorkout: (w: WorkoutData) => void;
}) {
  const today = new Date();
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  // Build set of workouts by date string
  const workoutsByDate = workouts.reduce<Record<string, WorkoutData[]>>((acc, w) => {
    const key = new Date(w.started_at).toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(w);
    return acc;
  }, {});

  // Streak calculation
  const daySet = new Set(workouts.map(w => new Date(w.started_at).toDateString()));
  let streak = 0;
  for (let d = 0; d < 90; d++) {
    const day = new Date(today); day.setDate(today.getDate() - d);
    if (daySet.has(day.toDateString())) streak++;
    else if (d > 0) break;
  }
  // Rest days in last 30 days
  let restDays = 0;
  for (let d = 0; d < 30; d++) {
    const day = new Date(today); day.setDate(today.getDate() - d);
    if (!daySet.has(day.toDateString())) restDays++;
  }

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonth = () => { const d = new Date(calendarDate); d.setMonth(d.getMonth() - 1); setCalendarDate(d); };
  const nextMonth = () => { const d = new Date(calendarDate); d.setMonth(d.getMonth() + 1); setCalendarDate(d); };

  const monthLabel = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const cellSize = Math.floor((SCREEN_W - 40) / 7);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
      {/* Streak banner */}
      <View style={{
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: Colors.surface, borderRadius: 12, padding: 12,
        borderWidth: 1, borderColor: Colors.gold + '40', marginBottom: 12,
      }}>
        <Text style={{ color: Colors.gold, fontWeight: '800', fontSize: 14 }}>
          🔥 {streak} day streak
        </Text>
        <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
          Rest days (30d): {restDays}
        </Text>
      </View>

      {/* Month nav */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <TouchableOpacity onPress={prevMonth} style={{ padding: 8 }}>
          <Text style={{ color: Colors.accent, fontSize: 20, fontWeight: '700' }}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>{monthLabel}</Text>
        <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
          <Text style={{ color: Colors.accent, fontSize: 20, fontWeight: '700' }}>{'›'}</Text>
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
          <View key={i} style={{ width: cellSize, alignItems: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, fontWeight: '700' }}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`e${i}`} style={{ width: cellSize, height: cellSize + 20 }} />;
          const dateObj = new Date(year, month, day);
          const dateStr = dateObj.toDateString();
          const isToday = dateStr === today.toDateString();
          const dayWorkouts = workoutsByDate[dateStr] ?? [];
          const hasWorkout = dayWorkouts.length > 0;
          const firstWorkout = dayWorkouts[0];

          return (
            <TouchableOpacity
              key={`d${day}`}
              style={{ width: cellSize, height: cellSize + 20, alignItems: 'center', paddingTop: 4 }}
              onPress={() => { if (hasWorkout && firstWorkout) onSelectWorkout(firstWorkout); }}
              activeOpacity={hasWorkout ? 0.7 : 1}
            >
              <View style={{
                width: cellSize - 4, height: cellSize - 4, borderRadius: (cellSize - 4) / 2,
                backgroundColor: hasWorkout ? Colors.accent : 'transparent',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: isToday ? 2 : 0,
                borderColor: isToday ? (hasWorkout ? Colors.text : Colors.accent) : 'transparent',
              }}>
                <Text style={{
                  color: hasWorkout ? Colors.text : isToday ? Colors.accent : Colors.textSecondary,
                  fontSize: 12, fontWeight: hasWorkout || isToday ? '800' : '400',
                }}>
                  {day}
                </Text>
              </View>
              {hasWorkout && (
                <Text style={{ color: Colors.textMuted, fontSize: 8, marginTop: 1, textAlign: 'center', width: cellSize - 2 }} numberOfLines={1}>
                  {firstWorkout.name.slice(0, 8)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── WorkoutBottomSheet ────────────────────────────────────────────────────
function WorkoutBottomSheet({ workout, onClose }: { workout: WorkoutData; onClose: () => void }) {
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const formatDuration = (mins: number) => {
    if (!mins) return '—';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };
  const formatVolume = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);

  return (
    <Modal visible transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={{
          backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: 24, paddingBottom: 40, borderTopWidth: 1, borderTopColor: Colors.border,
          maxHeight: '70%',
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 }}>{workout.name}</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>{formatDate(workout.started_at)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{
              backgroundColor: Colors.surface2, borderRadius: 16, width: 32, height: 32,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: Colors.textMuted, fontSize: 16, fontWeight: '700' }}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Duration', value: formatDuration(workout.duration_mins) },
              { label: 'Volume', value: `${formatVolume(workout.total_volume)} lbs` },
              { label: 'Sets', value: String(workout.sets_count) },
            ].map((s, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: Colors.surface2, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</Text>
                <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>{s.value}</Text>
              </View>
            ))}
          </View>

          {/* Muscle group tags */}
          {workout.muscle_groups.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 14 }}>
              {workout.muscle_groups.map((mg, i) => (
                <View key={i} style={{
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                  backgroundColor: getMuscleColor(mg) + '20', borderWidth: 1, borderColor: getMuscleColor(mg) + '50',
                }}>
                  <Text style={{ color: getMuscleColor(mg), fontSize: 11, fontWeight: '700' }}>{mg}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Exercises */}
          <ScrollView showsVerticalScrollIndicator={false}>
            {workout.exercises.map((ex, i) => (
              <Text key={i} style={{
                color: Colors.textSecondary, fontSize: 13, paddingVertical: 6,
                borderBottomWidth: i < workout.exercises.length - 1 ? 1 : 0,
                borderBottomColor: Colors.border,
              }}>
                {ex}
              </Text>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── ExerciseProgressModal ─────────────────────────────────────────────────
type ChartMode = 'Max Weight' | 'Est. 1RM' | 'Volume';

function ExerciseProgressModal({
  exerciseName,
  workouts,
  onClose,
}: {
  exerciseName: string;
  workouts: WorkoutData[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<ChartMode>('Max Weight');
  const insets = useSafeAreaInsets();

  // Extract all sets for this exercise, grouped by date
  const byDate: { date: Date; maxWeight: number; est1rm: number; volume: number; sets: WorkoutSet[] }[] = [];

  for (const w of workouts) {
    const sets = w._sets.filter(s => s.exercises?.name === exerciseName);
    if (sets.length === 0) continue;
    const date = new Date(w.started_at);
    const maxWeight = Math.max(...sets.map(s => s.weight));
    const est1rm = Math.max(...sets.map(s => s.weight * (1 + s.reps / 30)));
    const volume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    byDate.push({ date, maxWeight, est1rm, volume, sets });
  }

  // Sort oldest to newest
  byDate.sort((a, b) => a.date.getTime() - b.date.getTime());

  const getValue = (d: typeof byDate[0]) => {
    if (mode === 'Max Weight') return d.maxWeight;
    if (mode === 'Est. 1RM') return d.est1rm;
    return d.volume;
  };

  const dataPoints = byDate.map(d => getValue(d));
  const totalSets = byDate.reduce((s, d) => s + d.sets.length, 0);
  const allTimePR = dataPoints.length > 0 ? Math.max(...dataPoints) : 0;

  // SVG chart
  const chartW = SCREEN_W - 48;
  const chartH = 180;
  const padL = 44, padR = 16, padT = 16, padB = 36;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  let polylinePoints = '';
  let circles: { cx: number; cy: number; val: number; isPR: boolean }[] = [];
  let xLabels: { x: number; label: string }[] = [];
  let yLabels: { y: number; label: string }[] = [];

  if (dataPoints.length >= 1) {
    const minVal = Math.min(...dataPoints);
    const maxVal = Math.max(...dataPoints);
    const range = maxVal - minVal;

    const toX = (i: number) => padL + (dataPoints.length === 1 ? plotW / 2 : (i / (dataPoints.length - 1)) * plotW);
    const toY = (v: number) => padT + plotH - (range === 0 ? plotH / 2 : ((v - minVal) / range) * plotH);

    const pts: string[] = [];
    dataPoints.forEach((v, i) => {
      const cx = toX(i);
      const cy = toY(v);
      pts.push(`${cx},${cy}`);
      circles.push({ cx, cy, val: v, isPR: v === maxVal });
    });
    polylinePoints = pts.join(' ');

    // X labels — every other if crowded
    const step = dataPoints.length > 6 ? 2 : 1;
    byDate.forEach((d, i) => {
      if (i % step === 0) {
        xLabels.push({ x: toX(i), label: `${d.date.getMonth() + 1}/${d.date.getDate()}` });
      }
    });

    // Y labels — 3 levels
    [minVal, (minVal + maxVal) / 2, maxVal].forEach(v => {
      yLabels.push({ y: toY(v), label: mode === 'Volume' ? `${Math.round(v / 1000)}k` : `${Math.round(v)}` });
    });
  }

  const modes: ChartMode[] = ['Max Weight', 'Est. 1RM', 'Volume'];

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: Colors.bg, paddingTop: insets.top }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingVertical: 16,
          borderBottomWidth: 1, borderBottomColor: Colors.border,
        }}>
          <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '900', flex: 1, marginRight: 12 }} numberOfLines={1}>
            {exerciseName}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              backgroundColor: Colors.surface2, borderRadius: 18, width: 36, height: 36,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: Colors.border,
            }}
          >
            <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700', lineHeight: 22 }}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {/* Mode toggle */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
            {modes.map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                style={{
                  flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
                  backgroundColor: mode === m ? Colors.accent : Colors.surface,
                  borderWidth: 1, borderColor: mode === m ? Colors.accent : Colors.border,
                }}
              >
                <Text style={{ color: Colors.text, fontSize: 11, fontWeight: '800' }} numberOfLines={1}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Chart */}
          <View style={{ backgroundColor: Colors.surface, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: Colors.border }}>
            {dataPoints.length === 0 ? (
              <View style={{ height: chartH, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: Colors.textMuted, fontSize: 13 }}>No data logged yet</Text>
              </View>
            ) : (
              <Svg width={chartW} height={chartH}>
                {/* Grid lines */}
                {yLabels.map((yl, i) => (
                  <Line key={i} x1={padL} y1={yl.y} x2={chartW - padR} y2={yl.y}
                    stroke={Colors.border} strokeWidth={1} strokeDasharray="4,4" />
                ))}

                {/* Y axis labels */}
                {yLabels.map((yl, i) => (
                  <SvgText key={i} x={padL - 6} y={yl.y + 4}
                    fontSize={9} fill={Colors.textMuted} textAnchor="end">
                    {yl.label}
                  </SvgText>
                ))}

                {/* X axis labels */}
                {xLabels.map((xl, i) => (
                  <SvgText key={i} x={xl.x} y={chartH - 4}
                    fontSize={8} fill={Colors.textMuted} textAnchor="middle">
                    {xl.label}
                  </SvgText>
                ))}

                {/* Polyline */}
                {dataPoints.length >= 2 && (
                  <Polyline points={polylinePoints} fill="none" stroke={Colors.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                )}

                {/* Data point circles */}
                {circles.map((c, i) => (
                  <Circle key={i} cx={c.cx} cy={c.cy}
                    r={c.isPR ? 7 : 5}
                    fill={c.isPR ? Colors.gold : Colors.accent}
                    stroke={Colors.bg} strokeWidth={1.5} />
                ))}

                {/* PR star text */}
                {circles.filter(c => c.isPR).map((c, i) => (
                  <SvgText key={i} x={c.cx} y={c.cy - 12} fontSize={10} fill={Colors.gold} textAnchor="middle">
                    PR
                  </SvgText>
                ))}
              </Svg>
            )}
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { label: 'All-Time PR', value: mode === 'Volume' ? `${Math.round(allTimePR / 1000 * 10) / 10}k lbs` : `${Math.round(allTimePR)} lbs` },
              { label: 'Sessions', value: String(byDate.length) },
              { label: 'Total Sets', value: String(totalSets) },
            ].map((s, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border }}>
                <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</Text>
                <Text style={{ color: i === 0 ? Colors.gold : Colors.text, fontSize: 15, fontWeight: '900' }}>{s.value}</Text>
              </View>
            ))}
          </View>

          {/* History list */}
          {byDate.length > 0 && (
            <View style={{ backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border }}>
              <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Session History</Text>
              {[...byDate].reverse().map((d, i) => (
                <View key={i} style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: i < byDate.length - 1 ? 1 : 0,
                  borderBottomColor: Colors.border,
                }}>
                  <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
                    {d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700' }}>
                    {mode === 'Max Weight' && `${d.maxWeight} lbs`}
                    {mode === 'Est. 1RM' && `${Math.round(d.est1rm)} lbs e1RM`}
                    {mode === 'Volume' && `${Math.round(d.volume)} lbs`}
                  </Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                    {d.sets.length} set{d.sets.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main History Screen ───────────────────────────────────────────────────
export default function HistoryScreen() {
  const { isPro, historyLimit } = useSubscription();
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<WorkoutData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutData | null>(null);
  const [chartExercise, setChartExercise] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [loadKey, setLoadKey] = useState(0);

  const isPrоRef = useRef(isPro);
  isPrоRef.current = isPro;

  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => {
      if (!user) return;
      if (loadKey === 0) setLoading(true);
      let query = supabase
        .from('workouts')
        .select(`*, workout_sets(weight, reps, set_number, rpe, note, logged_at, exercises(name, muscle_group))`)
        .eq('user_id', user.id)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(60);

      if (!isPrоRef.current) {
        query = query.gte('started_at', new Date(Date.now() - 90 * 86400000).toISOString());
      }

      const { data } = await query;
      if (cancelled) return;

      if (data) {
        const mapped: WorkoutData[] = data.map((w: any) => {
          const sets: WorkoutSet[] = w.workout_sets ?? [];
          const totalVolume = sets.reduce((s: number, x: any) => s + x.weight * x.reps, 0);
          const exerciseNames = [...new Set(sets.map((s: any) => s.exercises?.name).filter(Boolean))] as string[];
          const muscleGroups = [...new Set(sets.map((s: any) => s.exercises?.muscle_group).filter(Boolean))] as string[];
          const durMins = w.ended_at ? Math.round((new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000) : 0;
          const topSet = sets.reduce((best: any, s: any) => {
            const e1rm = s.weight * (1 + s.reps / 30);
            const bestE1rm = best ? best.weight * (1 + best.reps / 30) : 0;
            return e1rm > bestE1rm ? s : best;
          }, null);
          return {
            ...w,
            _sets: sets,
            sets_count: sets.length,
            total_volume: totalVolume,
            exercises: exerciseNames,
            muscle_groups: muscleGroups,
            top_set: topSet ? `${topSet.exercises?.name} ${topSet.weight}×${topSet.reps}` : '',
            duration_mins: durMins,
          };
        });
        setWorkouts(mapped);
        setInsights(computeInsights(mapped));
      }
      setLoading(false);
      setRefreshing(false);
    };
    doLoad();
    return () => { cancelled = true; };
  }, [loadKey, user?.id]); // loadKey increments on pull-to-refresh; reload on account switch

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatDuration = (mins: number) => {
    if (!mins) return '—';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const formatVolume = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  const thisMonthWorkouts = workouts.filter(w => daysBetween(new Date(w.started_at), new Date()) < 30).length;
  const thisMonthVolume = workouts.filter(w => daysBetween(new Date(w.started_at), new Date()) < 30).reduce((s, w) => s + w.total_volume, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); setLoadKey(k => k + 1); }}
            tintColor={Colors.accent}
          />
        }
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
          <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -1 }}>
            History
          </Text>
        </View>

        {/* View toggle */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, gap: 8 }}>
          {(['list', 'calendar'] as const).map(v => (
            <TouchableOpacity
              key={v}
              onPress={() => setViewMode(v)}
              style={{
                paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20,
                backgroundColor: viewMode === v ? Colors.accent : Colors.surface,
                borderWidth: 1, borderColor: viewMode === v ? Colors.accent : Colors.border,
              }}
            >
              <Text style={{
                color: Colors.text, fontWeight: '700', fontSize: 13,
                textTransform: 'capitalize',
              }}>
                {v}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats strip */}
        {workouts.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 }}>
            {[
              { label: 'This Month', value: String(thisMonthWorkouts), sub: 'sessions' },
              { label: 'Volume', value: formatVolume(thisMonthVolume), sub: 'lbs' },
              { label: 'All Time', value: String(workouts.length), sub: 'workouts' },
            ].map((s, i) => (
              <View key={i} style={{
                flex: 1,
                backgroundColor: Colors.surface,
                borderRadius: 16,
                paddingVertical: 14,
                paddingHorizontal: 10,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: Colors.border,
              }}>
                <Text style={{
                  color: Colors.textMuted,
                  fontSize: 9,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                  fontWeight: '700',
                }}>
                  {s.label}
                </Text>
                <Text style={{
                  color: Colors.text,
                  fontSize: 22,
                  fontWeight: '900',
                  letterSpacing: -0.5,
                }}>
                  {s.value}
                </Text>
                <Text style={{ color: Colors.textMuted, fontSize: 10, marginTop: 3 }}>{s.sub}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Insight cards */}
        {insights.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{
              color: Colors.textMuted,
              fontSize: 10,
              letterSpacing: 2,
              textTransform: 'uppercase',
              paddingHorizontal: 20,
              marginBottom: 12,
              fontWeight: '700',
            }}>
              Insights
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
            >
              {insights.map((ins, i) => (
                <View key={i} style={{
                  backgroundColor: Colors.surface,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: (ins.color ?? Colors.border) + '35',
                  borderLeftWidth: 3,
                  borderLeftColor: ins.color ?? Colors.border,
                  minWidth: 140,
                  shadowColor: ins.color ?? 'transparent',
                  shadowOpacity: ins.color ? 0.1 : 0,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                }}>
                  <Text style={{
                    color: Colors.textMuted,
                    fontSize: 10,
                    marginBottom: 6,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    fontWeight: '600',
                  }}>
                    {ins.label}
                  </Text>
                  <Text style={{
                    color: ins.color ?? Colors.text,
                    fontSize: 24,
                    fontWeight: '900',
                    letterSpacing: -1,
                  }}>
                    {ins.value}
                  </Text>
                  {ins.sub && (
                    <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 4 }}>
                      {ins.sub}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Calendar view */}
        {viewMode === 'calendar' && (
          <WorkoutCalendar
            workouts={workouts}
            calendarDate={calendarDate}
            setCalendarDate={setCalendarDate}
            onSelectWorkout={setSelectedWorkout}
          />
        )}

        {/* List view */}
        {viewMode === 'list' && (
          <View style={{ paddingHorizontal: 20 }}>
            {workouts.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <Text style={{ color: Colors.textMuted, fontSize: 15 }}>No workouts yet. Start lifting.</Text>
              </View>
            ) : (
              workouts.map(workout => {
                const isExpanded = expandedId === workout.id;
                const byExercise = workout._sets.reduce<Record<string, { sets: WorkoutSet[]; muscleGroup?: string }>>((acc, s: any) => {
                  const name = s.exercises?.name ?? 'Unknown';
                  if (!acc[name]) acc[name] = { sets: [], muscleGroup: s.exercises?.muscle_group };
                  acc[name].sets.push(s);
                  return acc;
                }, {});

                return (
                  <TouchableOpacity
                    key={workout.id}
                    onPress={() => setExpandedId(isExpanded ? null : workout.id)}
                    activeOpacity={0.82}
                    style={{
                      backgroundColor: Colors.surface,
                      borderRadius: 18,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: isExpanded ? Colors.accent + '45' : Colors.border,
                      overflow: 'hidden',
                      shadowColor: isExpanded ? Colors.accent : 'transparent',
                      shadowOpacity: 0.1,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 3 },
                    }}
                  >
                    {/* Workout header */}
                    <View style={{ padding: 18 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{
                            color: Colors.text,
                            fontSize: 15,
                            fontWeight: '800',
                            marginBottom: 3,
                            letterSpacing: -0.3,
                          }}>
                            {workout.name}
                          </Text>
                          <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                            {formatDate(workout.started_at)} · {formatDuration(workout.duration_mins)}
                          </Text>
                        </View>
                        <View style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: isExpanded ? Colors.accent + '20' : Colors.surface2,
                          borderWidth: 1,
                          borderColor: isExpanded ? Colors.accent + '40' : Colors.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Text style={{
                            color: isExpanded ? Colors.accent : Colors.textMuted,
                            fontSize: 11,
                            fontWeight: '800',
                          }}>
                            {isExpanded ? '▲' : '▼'}
                          </Text>
                        </View>
                      </View>

                      {/* Stats row */}
                      <View style={{ flexDirection: 'row', gap: 20, marginBottom: 10 }}>
                        {[
                          { label: 'Sets', value: String(workout.sets_count) },
                          { label: 'Volume', value: `${formatVolume(workout.total_volume)} lbs` },
                          { label: 'Exercises', value: String(workout.exercises.length) },
                        ].map((s, i) => (
                          <View key={i}>
                            <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>{s.label}</Text>
                            <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800', marginTop: 2 }}>{s.value}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Muscle group tags */}
                      {workout.muscle_groups.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                          {workout.muscle_groups.slice(0, 5).map((mg, i) => (
                            <View key={i} style={{
                              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                              backgroundColor: getMuscleColor(mg) + '18',
                              borderWidth: 1, borderColor: getMuscleColor(mg) + '40',
                            }}>
                              <Text style={{ color: getMuscleColor(mg), fontSize: 10, fontWeight: '700' }}>{mg}</Text>
                            </View>
                          ))}
                          {workout.muscle_groups.length > 5 && (
                            <Text style={{ color: Colors.textMuted, fontSize: 10, marginTop: 3 }}>
                              +{workout.muscle_groups.length - 5}
                            </Text>
                          )}
                        </View>
                      )}

                      {/* Top set */}
                      {workout.top_set && !isExpanded && (
                        <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>
                          Top set: {workout.top_set}
                        </Text>
                      )}
                    </View>

                    {/* Expanded set log */}
                    {isExpanded && (
                      <View style={{ borderTopWidth: 1, borderTopColor: Colors.border }}>
                        {Object.entries(byExercise).map(([exName, { sets, muscleGroup }], ei) => {
                          const color = getMuscleColor(muscleGroup ?? '');
                          return (
                            <View key={ei} style={{
                              paddingHorizontal: 16, paddingVertical: 12,
                              borderBottomWidth: ei < Object.keys(byExercise).length - 1 ? 1 : 0,
                              borderBottomColor: Colors.border,
                            }}>
                              {/* Exercise header — tappable for chart */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: color }} />
                                <TouchableOpacity
                                  style={{ flex: 1 }}
                                  onPress={() => setChartExercise(exName)}
                                >
                                  <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700' }}>
                                    {exName}
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setChartExercise(exName)}>
                                  <Text style={{ color: Colors.accent, fontSize: 11 }}>
                                    {sets.length} set{sets.length !== 1 ? 's' : ''} →
                                  </Text>
                                </TouchableOpacity>
                              </View>

                              {/* Sets */}
                              {sets.sort((a, b) => a.set_number - b.set_number).map((s, si) => (
                                <View key={si} style={{
                                  flexDirection: 'row', alignItems: 'center',
                                  marginBottom: 4, paddingLeft: 12, gap: 8,
                                }}>
                                  <Text style={{ color: Colors.textMuted, fontSize: 11, width: 18 }}>{s.set_number}</Text>
                                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>
                                    {s.weight === 0 ? 'BW' : s.weight} × {s.reps}
                                  </Text>
                                  {s.rpe && (
                                    <View style={{ backgroundColor: Colors.surface2, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                                      <Text style={{ color: Colors.textMuted, fontSize: 10, fontWeight: '700' }}>RPE {s.rpe}</Text>
                                    </View>
                                  )}
                                  {s.note && (
                                    <Text style={{ color: Colors.textSecondary, fontSize: 11, fontStyle: 'italic', flex: 1 }} numberOfLines={1}>
                                      "{s.note}"
                                    </Text>
                                  )}
                                </View>
                              ))}
                            </View>
                          );
                        })}

                        {/* Workout notes */}
                        {workout.notes && (
                          <View style={{
                            padding: 14, backgroundColor: Colors.surface2,
                            margin: 12, borderRadius: 10,
                          }}>
                            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                              Session notes
                            </Text>
                            <Text style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
                              {workout.notes}
                            </Text>
                          </View>
                        )}

                        {/* Delete workout */}
                        <TouchableOpacity
                          onPress={() => {
                            Alert.alert(
                              'Delete Workout',
                              `Delete "${workout.name}"? This cannot be undone.`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Delete',
                                  style: 'destructive',
                                  onPress: async () => {
                                    await supabase.from('workouts').delete().eq('id', workout.id);
                                    setWorkouts(prev => prev.filter(w => w.id !== workout.id));
                                    setExpandedId(null);
                                  },
                                },
                              ]
                            );
                          }}
                          style={{ alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border }}
                        >
                          <Text style={{ color: Colors.danger, fontSize: 13, fontWeight: '700' }}>Delete Workout</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}

            {/* Free tier history limit banner */}
            {!isPro && workouts.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowPaywall(true)}
                style={{
                  backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginTop: 8,
                  borderWidth: 1, borderColor: Colors.accent + '40', alignItems: 'center', gap: 4,
                }}
              >
                <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700' }}>Showing last 90 days</Text>
                <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '600' }}>Upgrade to Pro for full history →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Calendar bottom sheet */}
      {selectedWorkout && (
        <WorkoutBottomSheet workout={selectedWorkout} onClose={() => setSelectedWorkout(null)} />
      )}

      {/* Exercise progress chart modal */}
      {chartExercise && (
        <ExerciseProgressModal
          exerciseName={chartExercise}
          workouts={workouts}
          onClose={() => setChartExercise(null)}
        />
      )}

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason="Pro unlocks your complete workout history — every session, forever."
      />
    </SafeAreaView>
  );
}
