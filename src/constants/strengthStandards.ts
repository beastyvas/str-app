// ─── Strength Standards v2 ────────────────────────────────────────────────────
// Based on 2025 competition data from 58,154 drug-tested raw powerlifters
// via OpenPowerlifting. Absolute lb thresholds per bodyweight bucket.
// 6 ranks × 4 tiers each = 24 steps per lift per gender.

export type TierName = 'beginner' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type Lift = 'squat' | 'bench' | 'deadlift';
export type Gender = 'male' | 'female';

// TierName maps to rank index for backward compat with existing UI
export const TIER_ORDER: TierName[] = ['beginner', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];
export const TIER_LABELS: Record<TierName, string> = {
  beginner: 'Mortal', bronze: 'Awakened', silver: 'Ascendant',
  gold: 'Phantom', platinum: 'Sovereign', diamond: 'Godhand',
};

// ─── Base thresholds (men, ~180 lb anchor) ────────────────────────────────────
// 24 values per lift: [Mortal1, Mortal2, Mortal3, Mortal4, Awakened1, ... Godhand4]
const MEN_BASE: Record<Lift, number[]> = {
  squat: [
     95,  115,  135,  155,   // Mortal    1-4
    175,  195,  215,  235,   // Awakened  1-4
    255,  275,  300,  330,   // Ascendant 1-4
    355,  380,  410,  435,   // Phantom   1-4
    455,  475,  500,  520,   // Sovereign 1-4
    545,  570,  600,  640,   // Godhand   1-4
  ],
  bench: [
     55,   70,   85,  100,
    115,  130,  145,  160,
    175,  190,  205,  225,
    245,  260,  275,  295,
    310,  325,  345,  360,
    375,  395,  415,  440,
  ],
  deadlift: [
    115,  135,  155,  175,
    200,  225,  250,  275,
    300,  325,  350,  380,
    405,  430,  455,  480,
    500,  520,  545,  570,
    590,  615,  640,  670,
  ],
};

// ─── Base thresholds (women, ~140 lb anchor) ─────────────────────────────────
const WOMEN_BASE: Record<Lift, number[]> = {
  squat: [
     45,   60,   75,   90,
    105,  120,  135,  150,
    165,  180,  195,  210,
    225,  240,  255,  270,
    285,  300,  315,  330,
    345,  365,  385,  410,
  ],
  bench: [
     25,   35,   45,   55,
     65,   75,   85,   95,
    105,  115,  125,  135,
    145,  155,  165,  175,
    185,  195,  205,  215,
    225,  240,  255,  275,
  ],
  deadlift: [
     65,   80,   95,  110,
    130,  150,  170,  190,
    210,  230,  250,  270,
    290,  310,  330,  350,
    365,  380,  395,  410,
    425,  445,  465,  490,
  ],
};

const MEN_ANCHOR = 180;
const WOMEN_ANCHOR = 140;
const SCALE_PER_20LB = 2.5; // lbs per lift per 20lb BW difference

// [lowerBound, upperBound (exclusive), representativeMidpoint]
const MEN_BUCKETS: [number, number, number][] = [
  [0,   120, 105],
  [120, 140, 130],
  [140, 160, 150],
  [160, 180, 170],
  [180, 200, 190],
  [200, 220, 210],
  [220, 240, 230],
  [240, 260, 250],
  [260, 280, 270],
  [280, 300, 290],
  [300, Infinity, 315],
];

const WOMEN_BUCKETS: [number, number, number][] = [
  [0,   100,  90],
  [100, 115, 107],
  [115, 130, 122],
  [130, 145, 137],
  [145, 160, 152],
  [160, 175, 167],
  [175, 190, 182],
  [190, Infinity, 200],
];

function getBucketMidpoint(bwLbs: number, gender: Gender): number {
  const buckets = gender === 'female' ? WOMEN_BUCKETS : MEN_BUCKETS;
  const bucket = buckets.find(([lo, hi]) => bwLbs >= lo && bwLbs < hi) ?? buckets[buckets.length - 1];
  return bucket[2];
}

export function getScaledThresholds(lift: Lift, bwLbs: number, gender: Gender): number[] {
  const base = gender === 'female' ? WOMEN_BASE[lift] : MEN_BASE[lift];
  const anchor = gender === 'female' ? WOMEN_ANCHOR : MEN_ANCHOR;
  const midpoint = getBucketMidpoint(bwLbs, gender);
  const scale = ((midpoint - anchor) / 20) * SCALE_PER_20LB;
  // Round to nearest 5 lbs
  return base.map(t => Math.round((t + scale) / 5) * 5);
}

// ─── Core lookup ──────────────────────────────────────────────────────────────

export interface LiftTierResult {
  rank: number;           // 0=Mortal … 5=Godhand
  tier: number;           // 1–4 within the rank
  score: number;          // rank*4+(tier-1), 0–23; -1 = below all thresholds
  nextThreshold: number | null;
}

export function getLiftTierResult(
  lift: Lift,
  weight: number,
  bwLbs: number,
  gender: Gender
): LiftTierResult {
  const thresholds = getScaledThresholds(lift, bwLbs, gender);
  if (weight <= 0) return { rank: 0, tier: 0, score: -1, nextThreshold: thresholds[0] };

  let score = -1;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (weight >= thresholds[i]) { score = i; break; }
  }

  if (score === -1) return { rank: 0, tier: 0, score: -1, nextThreshold: thresholds[0] };

  const rank = Math.floor(score / 4);
  const tier = (score % 4) + 1;
  const nextThreshold = score < 23 ? thresholds[score + 1] : null;
  return { rank, tier, score, nextThreshold };
}

// ─── Backward-compat shim ─────────────────────────────────────────────────────
// Old code calls getTierForWeight(exerciseName, weight, bwLbs, gender)
// and expects a TierName back. Map rank → TierName.

const LIFT_KEY_MAP: Record<string, Lift> = {
  'barbell back squats': 'squat', 'barbell bench press': 'bench', 'deadlifts': 'deadlift',
  'squat': 'squat', 'bench': 'bench', 'deadlift': 'deadlift',
};

export function getTierForWeight(
  exerciseName: string,
  weight: number,
  bwLbs: number,
  gender: 'male' | 'female' | 'other' | null = 'male'
): TierName {
  const liftKey = LIFT_KEY_MAP[exerciseName.toLowerCase()];
  if (!liftKey) return 'beginner';
  const g: Gender = gender === 'female' ? 'female' : 'male';
  const { score } = getLiftTierResult(liftKey, weight, bwLbs, g);
  if (score < 0) return 'beginner';
  return TIER_ORDER[Math.min(Math.floor(score / 4), 5)];
}

// ─── Legacy export (some screens still reference STRENGTH_STANDARDS) ──────────
// Provide a minimal stub so old imports don't crash.
export interface StrengthStandard {
  type: 'lookup';
}
export const STRENGTH_STANDARDS: Record<string, StrengthStandard> = {};
