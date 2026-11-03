import { toDisplay, type WeightUnit } from '@/lib/units';

export interface WorkoutSet {
  weight: number;
  reps: number;
  rpe?: number;
  note?: string;
  set_number: number;
  exercises?: { name: string; muscle_group?: string };
}

export interface WorkoutData {
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
  /** PRs whose achieved_at falls inside this workout */
  pr_count: number;
}

export function mapWorkoutRows(rows: any[], unit: WeightUnit, prTimes: number[]): WorkoutData[] {
  return rows.map((w: any) => {
    const sets: WorkoutSet[] = w.workout_sets ?? [];
    const start = new Date(w.started_at).getTime();
    const end = w.ended_at ? new Date(w.ended_at).getTime() : start;
    const top = sets.reduce((best: any, s: any) => {
      const e = s.weight * (1 + s.reps / 30);
      return !best || e > best.weight * (1 + best.reps / 30) ? s : best;
    }, null);
    return {
      ...w,
      _sets: sets,
      sets_count: sets.length,
      total_volume: sets.reduce((n: number, x: any) => n + x.weight * x.reps, 0),
      exercises: [...new Set(sets.map((s: any) => s.exercises?.name).filter(Boolean))] as string[],
      muscle_groups: [...new Set(sets.map((s: any) => s.exercises?.muscle_group).filter(Boolean))] as string[],
      top_set: top ? `${top.exercises?.name} ${toDisplay(top.weight, unit)}×${top.reps}` : '',
      duration_mins: w.ended_at ? Math.round((end - start) / 60000) : 0,
      pr_count: prTimes.filter(t => t >= start && t <= end + 60000).length,
    };
  });
}

/** Monday of the week containing d, at 00:00 */
export function weekStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export type HistoryItem =
  | { type: 'week'; key: string; label: string; count: number; volume: number }
  | { type: 'workout'; key: string; workout: WorkoutData; first: boolean; last: boolean };

/** Flatten workouts into week headers + rows for one grouped FlashList. */
export function groupByWeek(workouts: WorkoutData[]): HistoryItem[] {
  const thisWeek = weekStart(new Date()).getTime();
  const groups = new Map<number, WorkoutData[]>();
  for (const w of workouts) {
    const k = weekStart(new Date(w.started_at)).getTime();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(w);
  }
  const out: HistoryItem[] = [];
  for (const [k, list] of groups) {
    const weeksAgo = Math.round((thisWeek - k) / (7 * 86400000));
    const label = weeksAgo === 0 ? 'This week' : weeksAgo === 1 ? 'Last week'
      : `Week of ${new Date(k).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    out.push({ type: 'week', key: `w${k}`, label, count: list.length, volume: list.reduce((n, w) => n + w.total_volume, 0) });
    list.forEach((w, i) => out.push({ type: 'workout', key: w.id, workout: w, first: i === 0, last: i === list.length - 1 }));
  }
  return out;
}

export const formatDuration = (mins: number) => (!mins ? '—' : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`);

export const formatDay = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};
