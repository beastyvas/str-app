// Workout-side cameo plumbing, kept out of workout.tsx. In-workout limits:
// at most two cameos — the first PR, plus one rest drop-in — and both appear
// only AFTER a set is logged, never while weight/reps are being typed.
import { supabase } from '@/lib/supabase';
import { DIRECT_NAMES } from '@/lib/powerLevel';
import { showCameo } from '@/components/cameo/useCameoStore';
import { toDisplay, type WeightUnit } from '@/lib/units';

export interface SessionCameoState {
  prShown: boolean;
  restDropinUsed: boolean;
  /** Last finished workout before this one (comeback detection) */
  lastEndedAt: string | null;
  /** Mean session volume over the previous 4 weeks (heavy_day) */
  avgVolume4w: number | null;
}

export const freshSessionCameoState = (): SessionCameoState => ({
  prShown: false, restDropinUsed: false, lastEndedAt: null, avgVolume4w: null,
});

/** Read once at workout start. Failure (offline) just disables those triggers. */
export async function fetchSessionCameoContext(userId: string): Promise<Pick<SessionCameoState, 'lastEndedAt' | 'avgVolume4w'>> {
  try {
    const since = new Date(Date.now() - 28 * 86400000).toISOString();
    const [lastRes, volRes] = await Promise.all([
      supabase.from('workouts').select('ended_at').eq('user_id', userId)
        .not('ended_at', 'is', null).order('ended_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('workouts').select('id, workout_sets(weight, reps, is_warmup)').eq('user_id', userId)
        .not('ended_at', 'is', null).gte('started_at', since),
    ]);
    const vols = ((volRes.data ?? []) as any[]).map(w =>
      (w.workout_sets ?? []).filter((s: any) => !s.is_warmup)
        .reduce((n: number, s: any) => n + Number(s.weight) * s.reps, 0),
    ).filter(v => v > 0);
    return {
      lastEndedAt: (lastRes.data as any)?.ended_at ?? null,
      avgVolume4w: vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : null,
    };
  } catch {
    return { lastEndedAt: null, avgVolume4w: null };
  }
}

const isCanonical = (exerciseName: string) =>
  Object.values(DIRECT_NAMES).some(names => names.includes(exerciseName.trim().toLowerCase()));

const liftWord = (exerciseName: string) => {
  const n = exerciseName.toLowerCase();
  if (DIRECT_NAMES.squat.includes(n)) return 'squat';
  if (DIRECT_NAMES.bench.includes(n)) return 'bench';
  if (DIRECT_NAMES.deadlift.includes(n)) return 'deadlift';
  return exerciseName;
};

/** Call after a set is logged. Returns true if a cameo was queued. */
export function afterSetLogged(
  state: SessionCameoState,
  set: { exerciseName: string; weight: number; reps: number; isPR: boolean },
  ctx: { name: string; unit: WeightUnit; restSeconds: number },
): boolean {
  const weight = `${toDisplay(set.weight, ctx.unit)} ${ctx.unit === 'kg' ? 'kg' : 'lb'}`;
  if (set.isPR && !state.prShown) {
    state.prShown = true;
    return showCameo('pr_hit', {
      name: ctx.name, lift: liftWord(set.exerciseName), weight, reps: set.reps,
    }, { passThrough: true, extras: { canonicalPR: isCanonical(set.exerciseName) } });
  }
  // One rest drop-in per workout, ~25% chance, only on rests of 60s+, a beat
  // after logging so it lands during the rest.
  if (!state.restDropinUsed && ctx.restSeconds >= 60 && Math.random() < 0.25) {
    state.restDropinUsed = true;
    setTimeout(() => showCameo('rest_dropin', { name: ctx.name, lift: liftWord(set.exerciseName) }, { passThrough: true }), 2500);
    return true;
  }
  return false;
}

/** Finish-time facts passed to the summary, which picks ONE cameo by priority. */
export interface FinishCameoFacts {
  heavy: boolean;
  comebackDays: number | null;
}

export function finishFacts(state: SessionCameoState, sessionVolume: number): FinishCameoFacts {
  const days = state.lastEndedAt
    ? Math.floor((Date.now() - new Date(state.lastEndedAt).getTime()) / 86400000)
    : null;
  return {
    heavy: state.avgVolume4w != null && sessionVolume >= state.avgVolume4w * 1.2,
    comebackDays: days != null && days >= 7 ? days : null,
  };
}
