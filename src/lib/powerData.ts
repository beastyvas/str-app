// Supabase plumbing for the Power Level. The math lives in powerLevel.ts
// (pure); this only fetches the inputs and persists the result.
import { supabase } from '@/lib/supabase';
import { POWER_EXERCISE_NAMES, WINDOW_DAYS, type LiftSet, type PowerReading } from '@/lib/powerLevel';

/**
 * Every canonical- and proxy-lift set from the last 180 days, plus
 * personal_records rows for those lifts (where onboarding-entered numbers
 * land). Only the needed columns; names filtered server-side.
 */
export async function fetchPowerInputs(userId: string): Promise<LiftSet[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();
  const [setsRes, prRes] = await Promise.all([
    supabase
      .from('workout_sets')
      .select('weight, reps, logged_at, is_warmup, exercises!inner(name), workouts!inner(user_id)')
      .eq('workouts.user_id', userId)
      .in('exercises.name', POWER_EXERCISE_NAMES)
      .gte('logged_at', since)
      .order('logged_at', { ascending: false })
      .limit(2000),
    supabase
      .from('personal_records')
      .select('weight, reps, achieved_at, exercises!inner(name)')
      .eq('user_id', userId)
      .in('exercises.name', POWER_EXERCISE_NAMES),
  ]);

  const sets: LiftSet[] = ((setsRes.data ?? []) as any[]).map(s => ({
    exerciseName: s.exercises?.name ?? '',
    weight: Number(s.weight),
    reps: s.reps,
    achievedAt: s.logged_at,
    isWarmup: !!s.is_warmup,
  }));
  const prs: LiftSet[] = ((prRes.data ?? []) as any[]).map(p => ({
    exerciseName: p.exercises?.name ?? '',
    weight: Number(p.weight),
    reps: p.reps,
    achievedAt: p.achieved_at,
  }));
  return [...sets, ...prs];
}

/**
 * Persist the reading to public.users (migration 029). Fire-and-forget: if
 * 029 hasn't run yet the update errors and is ignored — the app never
 * depends on the stored copy for the current user.
 */
export function savePowerReading(userId: string, r: PowerReading) {
  supabase
    .from('users')
    .update({
      power_level: r.confidence === 'calibrating' ? null : r.power,
      power_confidence: r.confidence,
      rank_tier_key: r.confidence === 'calibrating' ? null : r.rank.tier.key,
      rank_sub_tier: r.confidence === 'calibrating' ? null : r.rank.subTier,
    } as any)
    .eq('id', userId)
    .then(({ error }) => {
      if (error && __DEV__) console.warn('[power] save skipped (has migration 029 run?):', error.message);
    });
}
