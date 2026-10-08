// Workout history → CSV, handed to the iOS share sheet (Files, AirDrop, Mail).
// Columns mirror the Hevy export layout that parseHevyCSV (workoutParser.ts)
// reads, so an STR export re-imports cleanly into STR — or into anything else
// that understands Hevy's format.
import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

const LBS_PER_KG = 2.20462;
const PAGE = 100; // workouts per request — stays well under the 1000-row cap

const HEADER = [
  'Title', 'Start Time', 'End Time', 'Duration (min)', 'Workout Comment',
  'Exercise Name', 'Set Order', 'Weight (lbs)', 'Weight (kg)', 'Reps', 'RPE', 'Warmup', 'Notes',
];

// RFC 4180 quoting. Newlines are flattened because the importer splits rows
// on '\n' without honoring quotes.
function cell(v: unknown): string {
  if (v == null) return '';
  const s = String(v).replace(/\r?\n/g, ' ');
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function fetchAllWorkouts(userId: string): Promise<any[]> {
  const all: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('workouts')
      .select('name, started_at, ended_at, notes, workout_sets(set_number, weight, reps, rpe, note, is_warmup, logged_at, exercises(name))')
      .eq('user_id', userId)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

export function workoutsToCSV(workouts: any[]): string {
  const rows: string[] = [HEADER.join(',')];
  for (const w of workouts) {
    const start = new Date(w.started_at);
    const end = w.ended_at ? new Date(w.ended_at) : null;
    const durMin = end ? Math.round((end.getTime() - start.getTime()) / 60000) : '';
    const sets = [...(w.workout_sets ?? [])].sort((a: any, b: any) =>
      String(a.logged_at ?? '').localeCompare(String(b.logged_at ?? '')) || a.set_number - b.set_number,
    );
    for (const s of sets) {
      const lbs = Number(s.weight) || 0;
      rows.push([
        cell(w.name),
        cell(start.toISOString()),
        cell(end?.toISOString() ?? ''),
        cell(durMin),
        cell(w.notes),
        cell(s.exercises?.name ?? ''),
        cell(s.set_number),
        cell(lbs),
        cell(Math.round((lbs / LBS_PER_KG) * 10) / 10),
        cell(s.reps),
        cell(s.rpe ?? ''),
        cell(s.is_warmup ? 'yes' : ''),
        cell(s.note),
      ].join(','));
    }
  }
  return rows.join('\n');
}

/** Builds the CSV for every completed workout and opens the share sheet. */
export async function exportWorkoutHistory(userId: string): Promise<{ workouts: number }> {
  const workouts = await fetchAllWorkouts(userId);
  const csv = workoutsToCSV(workouts);
  const stamp = new Date().toISOString().slice(0, 10);
  const uri = `${FileSystem.cacheDirectory}STR-workouts-${stamp}.csv`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  // iOS shares the file itself; Android's Share can't take a file URL, so it
  // falls back to the text.
  await Share.share(
    Platform.OS === 'ios' ? { url: uri, title: 'STR workout history' } : { message: csv, title: 'STR workout history' },
  );
  return { workouts: workouts.length };
}
