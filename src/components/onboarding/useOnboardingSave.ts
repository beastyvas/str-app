import { useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { screenText } from '@/lib/contentFilter';
import { toLbs } from '@/lib/units';
import { computePowerReading, e1rmOf, experienceFromRank, type LiftSet, type PowerReading } from '@/lib/powerLevel';
import { savePowerReading } from '@/lib/powerData';
import { useWorldStore } from '@/theme/useWorldStore';
import { entryValid, type LiftEntry } from './LiftStep';
import type { Standards } from './BodyStep';

// Both the original seed names and the 017 catalog names exist in the DB.
const LIFT_EXERCISES: Record<LiftEntry['lift'], string[]> = {
  squat: ['Barbell Back Squats', 'Barbell Back Squat'],
  bench: ['Barbell Bench Press'],
  deadlift: ['Deadlifts', 'Deadlift'],
};

interface SaveInput {
  userId: string | undefined;
  displayName: string;
  username: string;
  bodyweight: string;
  unit: 'lbs' | 'kg';
  standards: Standards;
  /** null = "I don't know yet" */
  entries: LiftEntry[] | null;
}

/**
 * Persists onboarding. Keeps the hard-won robustness of the old flow:
 * re-resolving the user id if the session dropped, the username-taken check,
 * screenText content filtering, canonical-lbs storage, PR upserts. Returns
 * the first Power Level reading (calibrating when no lifts), or null on error.
 */
export function useOnboardingSave() {
  const [saving, setSaving] = useState(false);

  const save = async (input: SaveInput): Promise<PowerReading | null> => {
    const bw = parseFloat(input.bodyweight);
    if (!bw) { Alert.alert('Enter your bodyweight to continue'); return null; }
    const nameIssue = screenText(input.displayName, 'display name') || screenText(input.username, 'username');
    if (nameIssue) { Alert.alert('Not allowed', nameIssue); return null; }

    setSaving(true);
    try {
      // The auth context's user can be null here if the session token was
      // refreshed or dropped mid-onboarding (App Review hit this: "Cannot
      // read property 'id' of null"). Re-resolve it before touching .id.
      let uid = input.userId;
      if (!uid) {
        const { data } = await supabase.auth.getUser();
        uid = data.user?.id;
      }
      if (!uid) {
        Alert.alert('Connection issue', "Couldn't verify your session. Check your connection and try again.");
        return null;
      }

      const cleanUsername = input.username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
      if (cleanUsername) {
        const { data: taken } = await supabase
          .from('public_profiles').select('id').eq('username', cleanUsername).neq('id', uid).maybeSingle();
        if (taken) {
          Alert.alert('Username taken', `@${cleanUsername} is already in use. Pick a different handle.`);
          return null;
        }
      }

      const bwLbs = Math.round(toLbs(bw, input.unit) * 10) / 10;
      const now = new Date().toISOString();

      // A recent set → Epley estimated 1RM, stored canonical lbs.
      const lifts = (input.entries ?? []).filter(entryValid).map(e => {
        const weightLbs = toLbs(parseFloat(e.weight), input.unit);
        const e1rm = e1rmOf(weightLbs, parseInt(e.reps, 10)) ?? 0;
        return { lift: e.lift, e1rm: Math.round(e1rm * 100) / 100 };
      }).filter(l => l.e1rm > 0);

      const sets: LiftSet[] = lifts.map(l => ({
        exerciseName: LIFT_EXERCISES[l.lift][0], weight: l.e1rm, reps: 1, achievedAt: now,
      }));
      const reading = computePowerReading(sets, bwLbs, input.standards, input.unit);

      // Experience is inferred from the reading now (onboarding no longer asks).
      const { error } = await supabase.from('users').update({
        display_name: input.displayName.trim() || null,
        username: cleanUsername || null,
        bodyweight_lbs: bwLbs,
        unit_pref: input.unit,
        gender: input.standards,
        experience_level: reading.confidence === 'calibrating' ? 'beginner' : experienceFromRank(reading.rank.tier.key),
      }).eq('id', uid);
      if (error) throw error;

      if (lifts.length > 0) {
        const { data: exRows } = await supabase
          .from('exercises').select('id, name')
          .in('name', lifts.flatMap(l => LIFT_EXERCISES[l.lift]))
          .eq('is_custom', false);
        for (const l of lifts) {
          // Prefer the first (seed) name, fall back to the catalog spelling.
          const ex = LIFT_EXERCISES[l.lift]
            .map(n => (exRows ?? []).find((r: any) => r.name === n))
            .find(Boolean) as { id: string } | undefined;
          if (!ex) continue;
          await supabase.from('personal_records').upsert({
            user_id: uid, exercise_id: ex.id, weight: l.e1rm, reps: 1, achieved_at: now,
          }, { onConflict: 'user_id,exercise_id' });
        }
      }

      savePowerReading(uid, reading);
      if (reading.confidence !== 'calibrating') {
        useWorldStore.getState().setRank(reading.rank.tier.key, reading.rank.subTier);
      }
      return reading;
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save');
      return null;
    } finally {
      setSaving(false);
    }
  };

  return { save, saving };
}
