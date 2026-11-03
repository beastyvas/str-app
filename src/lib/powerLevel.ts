// ─── Power Level ──────────────────────────────────────────────────────────────
// One bodyweight-relative strength number, ~0–9,000, computed from EVERY
// relevant set logged in the last 180 days (not just PRs). Ranks (Mortal →
// Godhand, I–IV) sit on top of it as milestones. Pure functions only — no
// Supabase calls; useHomeData / the workout flow fetch and pass data in.
//
//   1. e1RM per set (Epley): weight × (1 + reps/30). 1 ≤ reps ≤ 10, weight > 0.
//      A 1-rep set is just its weight.
//   2. Best estimate per canonical lift (squat/bench/deadlift) over 180 days:
//      direct sets + personal_records rows. With no direct data, the best
//      proxy × coefficient (PROXY_COEFFICIENTS).
//   3. Continuous position p on the 24 scaled thresholds t[0..23]:
//        e1rm < t0          → p = e1rm / t0                         (0–1)
//        t[i] ≤ e1rm < t[i+1] → p = (i+1) + (e1rm − t[i]) / (t[i+1] − t[i])
//        e1rm ≥ t23         → p = 24 + (e1rm − t23)/(t23 − t22), cap 26
//   4. power = round(mean(available p) × 375). 24 × 375 = 9,000, so averaging
//      exactly Godhand IV is 9,000 — "over 9000" means past Godhand IV.
//   5. Rank uses the same e1RMs with the existing WEAKEST-LINK logic. Power is
//      the average, rank is your weakest lift — "your bench is holding your
//      rank back" is the story.
//
// Hand-computed examples (180 lb male → bucket midpoint 190, thresholds round
// back to the base table):
//
//   lift      set        e1RM    bracket              p
//   squat     315 × 1    315.0   300 ≤ x < 330 (i=10)  11 + 15/30   = 11.500
//   bench     225 × 3    247.5   245 ≤ x < 260 (i=12)  13 + 2.5/15  = 13.167
//   deadlift  405 × 1    405.0   405 ≤ x < 430 (i=12)  13 + 0/25    = 13.000
//   mean p = 12.556 → power = round(12.556 × 375) = 4,708 · confidence full
//   rank: weakest = squat (i=10) → Ascendant III; hint "+15 lb on squat to
//   reach Ascendant IV"
//
//   Same lifter, bench from Incline Barbell Bench 185 × 5 only:
//   e1RM 185 × (1 + 5/30) = 215.83 × 1.20 = 259.0 → 245 ≤ x < 260 (i=12)
//   p = 13 + 14/15 = 13.933 → mean (11.5 + 13.933 + 13)/3 = 12.811 → 4,804
//   confidence partial
//
//   Beginner (180 lb male): squat 135×1, bench 95×1, deadlift 185×1
//   p = 3.000, 3 + 10/15 = 3.667, 4 + 10/25 = 4.400 → mean 3.689 → 1,383

import { getScaledThresholds, type Gender, type Lift } from '@/constants/strengthStandards';
import { getRankResult, RANK_TIERS, ROMAN, type RankResult } from '@/constants/ranks';
import { toDisplay, type WeightUnit } from '@/lib/units';

export type CanonicalLift = Lift;
export const CANONICAL_LIFTS: CanonicalLift[] = ['squat', 'bench', 'deadlift'];
export const LIFT_LABEL: Record<CanonicalLift, string> = { squat: 'squat', bench: 'bench', deadlift: 'deadlift' };

export const POWER_SCALE = 375;
export const WINDOW_DAYS = 180;

/**
 * Direct exercise names per canonical lift (lower-cased). Both the original
 * seed names ("Barbell Back Squats", "Deadlifts") and the 017 catalog names
 * ("Barbell Back Squat", "Deadlift") exist in the DB.
 */
export const DIRECT_NAMES: Record<CanonicalLift, string[]> = {
  squat: ['barbell back squats', 'barbell back squat', 'low bar squat'],
  bench: ['barbell bench press'],
  deadlift: ['deadlifts', 'deadlift', 'sumo deadlift'],
};

/**
 * Proxy exercise → canonical lift coefficient. Only used when a lift has NO
 * direct data in the window. Tunable. Machines, leg press and Smith are
 * excluded on purpose (too variable).
 *
 * Dumbbell Bench Press: STR logs dumbbell weight PER HAND (confirmed by the
 * owner), so the coefficient is 2.4 (1.2 × 2). If that ever changes to total
 * weight, use 1.2.
 */
export const PROXY_COEFFICIENTS: { lift: CanonicalLift; names: string[]; coefficient: number }[] = [
  { lift: 'squat', names: ['front squat', 'barbell front squat'], coefficient: 1.2 },
  // No "Barbell Box Squat" in the catalog; Pause/Paused Squat is.
  { lift: 'squat', names: ['pause squat', 'paused squat'], coefficient: 1.05 },
  { lift: 'bench', names: ['incline barbell bench press'], coefficient: 1.2 },
  { lift: 'bench', names: ['close grip bench press'], coefficient: 1.1 },
  { lift: 'bench', names: ['dumbbell bench press'], coefficient: 2.4 },
  { lift: 'deadlift', names: ['romanian deadlift', 'barbell rdls'], coefficient: 1.35 },
  { lift: 'deadlift', names: ['trap bar deadlift'], coefficient: 0.92 },
  { lift: 'deadlift', names: ['rack pull'], coefficient: 0.85 },
];

/** Every exercise name (catalog casing) the Power Level query needs, for a server-side `.in()` filter. */
export const POWER_EXERCISE_NAMES: string[] = [
  'Barbell Back Squats', 'Barbell Back Squat', 'Low Bar Squat',
  'Barbell Bench Press',
  'Deadlifts', 'Deadlift', 'Sumo Deadlift',
  'Front Squat', 'Barbell Front Squat', 'Pause Squat', 'Paused Squat',
  'Incline Barbell Bench Press', 'Close Grip Bench Press', 'Dumbbell Bench Press',
  'Romanian Deadlift', 'Barbell RDLs', 'Trap Bar Deadlift', 'Rack Pull',
];

export interface LiftSet {
  exerciseName: string;
  weight: number; // lbs
  reps: number;
  achievedAt?: string | null;
  isWarmup?: boolean;
}

export interface LiftEstimate {
  e1rm: number;
  source: 'direct' | 'proxy' | 'none';
  fromExercise: string | null;
  /** The set that produced the estimate, for "est. from 225 × 3, Oct 28" */
  fromWeight: number | null;
  fromReps: number | null;
  achievedAt: string | null;
}

export interface PowerReading {
  power: number; // 0–9,750
  /** full = all 3 lifts direct; partial = any proxy or missing lift; calibrating = no data */
  confidence: 'full' | 'partial' | 'calibrating';
  lifts: Record<CanonicalLift, LiftEstimate & { p: number | null }>;
  weakest: CanonicalLift | null;
  /** e.g. "+15 lb on bench to reach Awakened III" */
  nextRankHint: string | null;
  /** Rank computed from the same e1RMs (weakest link) */
  rank: RankResult;
  /** Within 5% of the next rank threshold on the weakest lift (ゴゴゴ) */
  nearRankUp: boolean;
}

/** Step 1 — Epley e1RM, or null when the set doesn't qualify. */
export function e1rmOf(weight: number, reps: number): number | null {
  if (!(weight > 0) || reps < 1 || reps > 10) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

const lc = (s: string) => s.trim().toLowerCase();

/** Step 2 — best estimate per canonical lift within the window. */
export function estimateLifts(sets: LiftSet[], now = Date.now()): Record<CanonicalLift, LiftEstimate> {
  const cutoff = now - WINDOW_DAYS * 86400000;
  const inWindow = sets.filter(s =>
    !s.isWarmup && (!s.achievedAt || new Date(s.achievedAt).getTime() >= cutoff)
  );

  const best = (names: string[], coef = 1): LiftEstimate | null => {
    let out: LiftEstimate | null = null;
    for (const s of inWindow) {
      if (!names.includes(lc(s.exerciseName))) continue;
      const e = e1rmOf(s.weight, s.reps);
      if (e == null) continue;
      const v = e * coef;
      if (!out || v > out.e1rm) {
        out = {
          e1rm: v, source: coef === 1 ? 'direct' : 'proxy', fromExercise: s.exerciseName,
          fromWeight: s.weight, fromReps: s.reps, achievedAt: s.achievedAt ?? null,
        };
      }
    }
    return out;
  };

  const result = {} as Record<CanonicalLift, LiftEstimate>;
  for (const lift of CANONICAL_LIFTS) {
    const direct = best(DIRECT_NAMES[lift]);
    if (direct) { result[lift] = direct; continue; }
    let proxy: LiftEstimate | null = null;
    for (const px of PROXY_COEFFICIENTS.filter(p => p.lift === lift)) {
      const e = best(px.names, px.coefficient);
      if (e && (!proxy || e.e1rm > proxy.e1rm)) proxy = { ...e, source: 'proxy' };
    }
    result[lift] = proxy ?? {
      e1rm: 0, source: 'none', fromExercise: null, fromWeight: null, fromReps: null, achievedAt: null,
    };
  }
  return result;
}

/** Step 3 — continuous position on the 24 thresholds. */
export function positionOf(e1rm: number, t: number[]): number {
  if (e1rm < t[0]) return Math.max(0, e1rm / t[0]);
  for (let i = 0; i < t.length - 1; i++) {
    if (e1rm >= t[i] && e1rm < t[i + 1]) return i + 1 + (e1rm - t[i]) / (t[i + 1] - t[i]);
  }
  const n = t.length - 1;
  return Math.min(26, n + 1 + (e1rm - t[n]) / (t[n] - t[n - 1]));
}

const CANON_EXERCISE: Record<CanonicalLift, string> = {
  squat: 'Barbell Back Squats', bench: 'Barbell Bench Press', deadlift: 'Deadlifts',
};

/** Step 5 — rank from the reading's e1RMs, keeping the weakest-link logic. */
export function getRankFromEstimates(
  lifts: Record<CanonicalLift, LiftEstimate>,
  bodyweightLbs: number,
  gender: Gender,
): RankResult {
  const prs = CANONICAL_LIFTS
    .filter(l => lifts[l].source !== 'none')
    .map(l => ({ exerciseName: CANON_EXERCISE[l], weight: Math.round(lifts[l].e1rm), reps: 1 }));
  return getRankResult(prs, bodyweightLbs, false, gender);
}

/** Steps 3–5 together. */
export function computePowerReading(
  sets: LiftSet[],
  bodyweightLbs: number | null | undefined,
  gender: 'male' | 'female' | 'other' | null | undefined,
  unit: WeightUnit = 'lbs',
  now = Date.now(),
): PowerReading {
  const bw = Math.max(bodyweightLbs || 185, 50);
  const g: Gender = gender === 'female' ? 'female' : 'male';
  const est = estimateLifts(sets, now);

  const lifts = {} as PowerReading['lifts'];
  const ps: number[] = [];
  for (const lift of CANONICAL_LIFTS) {
    const e = est[lift];
    const p = e.source === 'none' ? null : positionOf(e.e1rm, getScaledThresholds(lift, bw, g));
    if (p != null) ps.push(p);
    lifts[lift] = { ...e, p };
  }

  const power = ps.length ? Math.round((ps.reduce((a, b) => a + b, 0) / ps.length) * POWER_SCALE) : 0;
  const confidence: PowerReading['confidence'] =
    ps.length === 0 ? 'calibrating'
    : CANONICAL_LIFTS.every(l => lifts[l].source === 'direct') ? 'full'
    : 'partial';

  const weakest = ps.length
    ? CANONICAL_LIFTS.filter(l => lifts[l].p != null).reduce((a, b) => (lifts[b].p! < lifts[a].p! ? b : a))
    : null;

  const rank = getRankFromEstimates(est, bw, g);

  // Next sub-tier is gated by the weakest lift reaching its next threshold.
  let nextRankHint: string | null = null;
  let nearRankUp = false;
  if (weakest) {
    const t = getScaledThresholds(weakest, bw, g);
    const e = lifts[weakest].e1rm;
    const nextIdx = t.findIndex(v => v > e);
    if (nextIdx >= 0) {
      const gapLbs = Math.max(1, Math.ceil(t[nextIdx] - e));
      const tier = RANK_TIERS[Math.floor(nextIdx / 4)];
      const sub = ROMAN[(nextIdx % 4) + 1];
      const tierName = tier.label.charAt(0) + tier.label.slice(1).toLowerCase();
      const gap = Math.max(1, Math.round(toDisplay(gapLbs, unit)));
      nextRankHint = `+${gap} ${unit === 'kg' ? 'kg' : 'lb'} on ${LIFT_LABEL[weakest]} to reach ${tierName} ${sub}`;
      nearRankUp = gapLbs / t[nextIdx] <= 0.05;
    }
  }

  return { power, confidence, lifts, weakest, nextRankHint, rank, nearRankUp };
}

/** Experience level inferred from rank (onboarding no longer asks). */
export function experienceFromRank(tierKey: string): 'beginner' | 'intermediate' | 'advanced' {
  if (tierKey === 'mortal') return 'beginner';
  if (tierKey === 'awakened') return 'intermediate';
  return 'advanced';
}

/** "Bench 245 est. from 225 × 3, Oct 28" */
export function describeSource(lift: CanonicalLift, e: LiftEstimate, unit: WeightUnit): string {
  const name = lift.charAt(0).toUpperCase() + lift.slice(1);
  if (e.source === 'none' || e.fromWeight == null) return `${name}: no data yet`;
  const date = e.achievedAt
    ? new Date(e.achievedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;
  const from = `${toDisplay(e.fromWeight, unit)} × ${e.fromReps}`;
  const via = e.source === 'proxy' ? ` ${e.fromExercise}` : '';
  return `${name} ${Math.round(toDisplay(e.e1rm, unit))} est. from${via} ${from}${date ? `, ${date}` : ''}`;
}

// ─── __DEV__ self-check (there is no test suite) ──────────────────────────────
export function powerLevelSelfCheck(): void {
  if (!__DEV__) return;
  const now = Date.parse('2026-06-01T00:00:00Z');
  const at = '2026-05-01T00:00:00Z';
  const fail: string[] = [];
  const expect = (label: string, got: unknown, want: unknown) => {
    if (got !== want) fail.push(`${label}: got ${String(got)}, want ${String(want)}`);
  };

  const a = computePowerReading([
    { exerciseName: 'Barbell Back Squats', weight: 315, reps: 1, achievedAt: at },
    { exerciseName: 'Barbell Bench Press', weight: 225, reps: 3, achievedAt: at },
    { exerciseName: 'Deadlifts', weight: 405, reps: 1, achievedAt: at },
  ], 180, 'male', 'lbs', now);
  expect('A power', a.power, 4708);
  expect('A confidence', a.confidence, 'full');
  expect('A weakest', a.weakest, 'squat');
  expect('A rank', `${a.rank.tier.key} ${a.rank.subTier}`, 'ascendant 3');
  expect('A hint', a.nextRankHint, '+15 lb on squat to reach Ascendant IV');

  const b = computePowerReading([
    { exerciseName: 'Barbell Back Squats', weight: 315, reps: 1, achievedAt: at },
    { exerciseName: 'Incline Barbell Bench Press', weight: 185, reps: 5, achievedAt: at },
    { exerciseName: 'Deadlifts', weight: 405, reps: 1, achievedAt: at },
  ], 180, 'male', 'lbs', now);
  expect('B power', b.power, 4804);
  expect('B confidence', b.confidence, 'partial');

  const c = computePowerReading([
    { exerciseName: 'Barbell Back Squat', weight: 135, reps: 1, achievedAt: at },
    { exerciseName: 'Barbell Bench Press', weight: 95, reps: 1, achievedAt: at },
    { exerciseName: 'Deadlift', weight: 185, reps: 1, achievedAt: at },
  ], 180, 'male', 'lbs', now);
  expect('C power', c.power, 1383);

  const d = computePowerReading([], 180, 'male', 'lbs', now);
  expect('D confidence', d.confidence, 'calibrating');
  expect('D power', d.power, 0);

  // Old sets fall out of the window; reps > 10 never count.
  const e = computePowerReading([
    { exerciseName: 'Deadlifts', weight: 500, reps: 1, achievedAt: '2025-01-01T00:00:00Z' },
    { exerciseName: 'Deadlifts', weight: 300, reps: 12, achievedAt: at },
  ], 180, 'male', 'lbs', now);
  expect('E confidence', e.confidence, 'calibrating');

  if (fail.length) console.warn('[powerLevel] self-check FAILED\n' + fail.join('\n'));
}
