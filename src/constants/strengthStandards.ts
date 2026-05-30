import { TierName } from './colors';

export interface StrengthStandard {
  type: 'bodyweight_multiplier' | 'fixed_weight';
  // For bodyweight_multiplier: thresholds are BW ratios (1RM / bodyweight)
  // For fixed_weight: thresholds are absolute lbs
  thresholds: {
    beginner: number;
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
    diamond: number;
  };
}

// Keyed by exercise name (lowercase)
export const STRENGTH_STANDARDS: Record<string, StrengthStandard> = {
  // ── COMPOUNDS (BW multiplier) ───────────────────────────────────────────────
  'barbell bench press': {
    type: 'bodyweight_multiplier',
    thresholds: { beginner: 0, bronze: 0.5, silver: 0.75, gold: 1.0, platinum: 1.25, diamond: 1.5 },
  },
  'incline barbell bench press': {
    type: 'bodyweight_multiplier',
    thresholds: { beginner: 0, bronze: 0.4, silver: 0.6, gold: 0.8, platinum: 1.0, diamond: 1.25 },
  },
  'overhead press': {
    type: 'bodyweight_multiplier',
    thresholds: { beginner: 0, bronze: 0.35, silver: 0.5, gold: 0.65, platinum: 0.8, diamond: 1.0 },
  },
  'barbell back squats': {
    type: 'bodyweight_multiplier',
    thresholds: { beginner: 0, bronze: 0.75, silver: 1.0, gold: 1.25, platinum: 1.5, diamond: 1.75 },
  },
  'deadlifts': {
    type: 'bodyweight_multiplier',
    thresholds: { beginner: 0, bronze: 1.0, silver: 1.25, gold: 1.5, platinum: 1.75, diamond: 2.25 },
  },
  'barbell row': {
    type: 'bodyweight_multiplier',
    thresholds: { beginner: 0, bronze: 0.5, silver: 0.75, gold: 1.0, platinum: 1.25, diamond: 1.5 },
  },
  'pendlay row': {
    type: 'bodyweight_multiplier',
    thresholds: { beginner: 0, bronze: 0.5, silver: 0.75, gold: 1.0, platinum: 1.25, diamond: 1.5 },
  },
  't-bar row': {
    type: 'bodyweight_multiplier',
    thresholds: { beginner: 0, bronze: 0.4, silver: 0.6, gold: 0.85, platinum: 1.1, diamond: 1.35 },
  },
  'pullups': {
    type: 'bodyweight_multiplier',
    thresholds: { beginner: 0, bronze: 0.5, silver: 0.75, gold: 1.0, platinum: 1.25, diamond: 1.5 },
  },
  'hip thrust': {
    type: 'bodyweight_multiplier',
    thresholds: { beginner: 0, bronze: 0.75, silver: 1.0, gold: 1.5, platinum: 2.0, diamond: 2.5 },
  },
  'leg press': {
    type: 'bodyweight_multiplier',
    thresholds: { beginner: 0, bronze: 1.0, silver: 1.5, gold: 2.0, platinum: 2.5, diamond: 3.0 },
  },
  'hack squats': {
    type: 'bodyweight_multiplier',
    thresholds: { beginner: 0, bronze: 0.75, silver: 1.0, gold: 1.5, platinum: 2.0, diamond: 2.5 },
  },
  'close grip bench press': {
    type: 'bodyweight_multiplier',
    thresholds: { beginner: 0, bronze: 0.4, silver: 0.6, gold: 0.85, platinum: 1.1, diamond: 1.35 },
  },
  'barbell rdls': {
    type: 'bodyweight_multiplier',
    thresholds: { beginner: 0, bronze: 0.75, silver: 1.0, gold: 1.25, platinum: 1.6, diamond: 2.0 },
  },
  'good mornings': {
    type: 'bodyweight_multiplier',
    thresholds: { beginner: 0, bronze: 0.3, silver: 0.5, gold: 0.7, platinum: 0.9, diamond: 1.1 },
  },

  // ── ISOLATION (fixed lbs) ────────────────────────────────────────────────
  'dumbbell lateral raise': {
    type: 'fixed_weight',
    thresholds: { beginner: 0, bronze: 15, silver: 25, gold: 35, platinum: 50, diamond: 65 },
  },
  'cable lateral raise': {
    type: 'fixed_weight',
    thresholds: { beginner: 0, bronze: 15, silver: 25, gold: 35, platinum: 50, diamond: 65 },
  },
  'bicep curl': {
    type: 'fixed_weight',
    thresholds: { beginner: 0, bronze: 25, silver: 40, gold: 55, platinum: 70, diamond: 90 },
  },
  'hammer curl': {
    type: 'fixed_weight',
    thresholds: { beginner: 0, bronze: 30, silver: 45, gold: 60, platinum: 75, diamond: 95 },
  },
  'preacher curl': {
    type: 'fixed_weight',
    thresholds: { beginner: 0, bronze: 40, silver: 60, gold: 80, platinum: 100, diamond: 125 },
  },
  'concentration curl': {
    type: 'fixed_weight',
    thresholds: { beginner: 0, bronze: 20, silver: 30, gold: 40, platinum: 55, diamond: 70 },
  },
  'skull crushers': {
    type: 'fixed_weight',
    thresholds: { beginner: 0, bronze: 40, silver: 65, gold: 90, platinum: 115, diamond: 145 },
  },
  'leg extensions': {
    type: 'fixed_weight',
    thresholds: { beginner: 0, bronze: 60, silver: 100, gold: 140, platinum: 180, diamond: 220 },
  },
  'leg curl': {
    type: 'fixed_weight',
    thresholds: { beginner: 0, bronze: 50, silver: 80, gold: 115, platinum: 150, diamond: 185 },
  },
  'lat pulldowns': {
    type: 'fixed_weight',
    thresholds: { beginner: 0, bronze: 70, silver: 110, gold: 150, platinum: 185, diamond: 220 },
  },
};

export function getTierForWeight(
  exerciseName: string,
  weightLbs: number,
  bodweightLbs: number
): TierName {
  const key = exerciseName.toLowerCase();
  const standard = STRENGTH_STANDARDS[key];
  if (!standard) return 'beginner';

  const value =
    standard.type === 'bodyweight_multiplier'
      ? bodweightLbs > 0 ? weightLbs / bodweightLbs : 0
      : weightLbs;

  const t = standard.thresholds;
  if (value >= t.diamond) return 'diamond';
  if (value >= t.platinum) return 'platinum';
  if (value >= t.gold) return 'gold';
  if (value >= t.silver) return 'silver';
  if (value >= t.bronze) return 'bronze';
  return 'beginner';
}

export const TIER_LABELS: Record<TierName, string> = {
  beginner: 'Beginner',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
};

export const TIER_ORDER: TierName[] = ['beginner', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];
