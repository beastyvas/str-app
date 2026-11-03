import { useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { parseAnyFormat, type ParsedWorkout } from '@/lib/workoutParser';
import { checkAndRecordPR } from '@/hooks/useWorkout';

export type Ex = { id: string; name: string; muscle_group: string };

// Merge duplicate exercises (same matchedId) within each workout
function mergeExercises(workouts: ParsedWorkout[]): ParsedWorkout[] {
  return workouts.map(w => {
    const seen = new Map<string, number>();
    const merged: typeof w.exercises = [];
    for (const ex of w.exercises) {
      if (ex.matchedId && seen.has(ex.matchedId)) merged[seen.get(ex.matchedId)!].sets.push(...ex.sets);
      else { seen.set(ex.matchedId ?? `__${merged.length}`, merged.length); merged.push({ ...ex, sets: [...ex.sets] }); }
    }
    return { ...w, exercises: merged };
  });
}

/** Paste-a-log import: parse → review/match → save (sets + PR upgrades). */
export function useImport(userId: string | undefined) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState<ParsedWorkout[] | null>(null);
  const [allExercises, setAllExercises] = useState<Ex[]>([]);

  const parse = async () => {
    if (!text.trim()) return;
    setParsing(true);
    setParsed(null);
    try {
      const { data } = await supabase.from('exercises').select('id, name, muscle_group').order('name');
      setAllExercises((data ?? []) as Ex[]);
      const workouts = parseAnyFormat(text, data ?? []);
      if (workouts.length === 0) {
        Alert.alert('Nothing found', 'Could not detect any workouts. Make sure sets look like "weight x reps".');
        return;
      }
      setParsed(workouts);
    } finally {
      setParsing(false);
    }
  };

  const match = (wi: number, ei: number, ex: { id: string; name: string }) => {
    setParsed(prev => prev && prev.map((w, a) => ({
      ...w,
      exercises: w.exercises.map((e, b) => (a === wi && b === ei ? { ...e, matchedName: ex.name, matchedId: ex.id } : e)),
    })));
  };

  const mergeAll = () => setParsed(prev => prev && mergeExercises(prev));

  const save = async () => {
    if (!parsed || !userId) return;
    setSaving(true);
    let saved = 0;
    // Best set per exercise (by e1RM) so imported history counts toward PRs — and rank.
    const best = new Map<string, { weight: number; reps: number; e1rm: number; at: string }>();
    try {
      for (const workout of mergeExercises(parsed)) {
        const { data: row, error } = await supabase.from('workouts').insert({
          user_id: userId,
          name: workout.name,
          started_at: workout.date.toISOString(),
          ended_at: new Date(workout.date.getTime() + 3600000).toISOString(),
          is_imported: true, // never show in social feed
        }).select().single();
        if (error || !row) continue;
        const sets: any[] = [];
        for (const ex of workout.exercises) {
          if (!ex.matchedId) continue;
          ex.sets.forEach((s, i) => {
            const at = new Date(workout.date.getTime() + i * 60000).toISOString();
            if (s.weight > 0 && s.reps > 0) {
              const e1rm = s.weight * (1 + s.reps / 30);
              const prev = best.get(ex.matchedId!);
              if (!prev || e1rm > prev.e1rm) best.set(ex.matchedId!, { weight: s.weight, reps: s.reps, e1rm, at });
            }
            sets.push({
              workout_id: row.id, exercise_id: ex.matchedId, set_number: i + 1, weight: s.weight, reps: s.reps,
              rpe: s.rpe ?? null, note: s.note ?? null, logged_at: at,
            });
          });
        }
        if (sets.length) await supabase.from('workout_sets').insert(sets);
        saved++;
      }
      // Same rule as live logging: only upgrades an existing PR, never lowers it
      let prs = 0;
      for (const [exId, b] of best) if (await checkAndRecordPR(userId, exId, b.weight, b.reps, b.at)) prs++;
      setParsed(null);
      setText('');
      Alert.alert('Imported', `Saved ${saved} workout${saved !== 1 ? 's' : ''}.${prs ? ` ${prs} PR${prs !== 1 ? 's' : ''} updated — your Power Level reflects them now.` : ''}`);
    } catch (e: any) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  return { text, setText, parsing, saving, parsed, setParsed, allExercises, parse, match, mergeAll, save };
}
