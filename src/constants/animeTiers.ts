import { TierName } from './colors';
import { getTierForWeight, TIER_ORDER, STRENGTH_STANDARDS } from './strengthStandards';

export interface AnimeTier {
  key: 'civilian' | 'training_arc' | 'tournament_arc' | 'rival_level' | 'final_boss' | 'god_tier';
  label: string;
  tagline: string;
  color: string;
  minScore: number; // average tier score needed
}

export const ANIME_TIERS: AnimeTier[] = [
  {
    key: 'civilian',
    label: 'Civilian',
    tagline: "The journey hasn't started yet. Log your first SBD.",
    color: '#555555',
    minScore: 0,
  },
  {
    key: 'training_arc',
    label: 'Training Arc',
    tagline: "The grind is just beginning. This is where legends are forged.",
    color: '#CD7F32',
    minScore: 0.5,
  },
  {
    key: 'tournament_arc',
    label: 'Tournament Arc',
    tagline: "You're a problem. Most people quit before this.",
    color: '#A8A9AD',
    minScore: 1.5,
  },
  {
    key: 'rival_level',
    label: 'Rival Level',
    tagline: "The protagonist fears your name.",
    color: '#FFB800',
    minScore: 2.5,
  },
  {
    key: 'final_boss',
    label: 'Final Boss',
    tagline: "You ARE the arc.",
    color: '#E5E4E2',
    minScore: 3.5,
  },
  {
    key: 'god_tier',
    label: 'God Tier',
    tagline: "There is no ceiling anymore.",
    color: '#B9F2FF',
    minScore: 4.5,
  },
];

export const SBD_EXERCISES = [
  { name: 'Barbell Back Squats', key: 'barbell back squats', label: 'SQ' },
  { name: 'Barbell Bench Press', key: 'barbell bench press', label: 'BP' },
  { name: 'Deadlifts',           key: 'deadlifts',           label: 'DL' },
];

export interface SBDResult {
  exercise: string;
  label: string;
  weight: number;
  tier: TierName;
  tierScore: number;
  nextTierWeight: number | null; // lbs needed for next tier
}

export interface AnimeTierResult {
  animeTier: AnimeTier;
  nextAnimeTier: AnimeTier | null;
  avgScore: number;
  lifts: SBDResult[];
  bottleneck: SBDResult | null; // the weakest lift holding overall tier back
}

export function getAnimeTierResult(
  prs: { exerciseName: string; weight: number; reps: number }[],
  bodyweightLbs: number
): AnimeTierResult {
  const bw = bodyweightLbs || 185;

  const lifts: SBDResult[] = SBD_EXERCISES.map(ex => {
    const pr = prs.find(p => p.exerciseName.toLowerCase() === ex.key);
    const weight = pr ? pr.weight : 0;
    const tier = getTierForWeight(ex.name, weight, bw);
    const tierScore = TIER_ORDER.indexOf(tier);

    // Calculate weight needed for next tier
    const standard = STRENGTH_STANDARDS[ex.key];
    let nextTierWeight: number | null = null;
    if (standard && tierScore < 5) {
      const nextTierName = TIER_ORDER[tierScore + 1];
      const nextThreshold = standard.thresholds[nextTierName];
      if (standard.type === 'bodyweight_multiplier') {
        nextTierWeight = Math.ceil(nextThreshold * bw);
      } else {
        nextTierWeight = nextThreshold;
      }
    }

    return { exercise: ex.name, label: ex.label, weight, tier, tierScore, nextTierWeight };
  });

  const logsgedLifts = lifts.filter(l => l.weight > 0);
  const avgScore = logsgedLifts.length > 0
    ? logsgedLifts.reduce((s, l) => s + l.tierScore, 0) / logsgedLifts.length
    : 0;

  // Find current anime tier
  let animeTier = ANIME_TIERS[0];
  for (const at of ANIME_TIERS) {
    if (avgScore >= at.minScore) animeTier = at;
  }

  const nextAnimeTier = ANIME_TIERS.find(at => at.minScore > avgScore) ?? null;

  // Bottleneck = lift with lowest tierScore (what's holding you back)
  const bottleneck = logsgedLifts.length > 0
    ? [...lifts].sort((a, b) => a.tierScore - b.tierScore)[0]
    : null;

  return { animeTier, nextAnimeTier, avgScore, lifts, bottleneck };
}

// How much each lift needs to increase for the next anime tier
export function getNextTierGap(result: AnimeTierResult): string | null {
  if (!result.nextAnimeTier || !result.bottleneck) return null;
  const b = result.bottleneck;
  if (!b.nextTierWeight || b.weight <= 0) return null;
  const gap = b.nextTierWeight - b.weight;
  if (gap <= 0) return null;
  return `+${gap} lbs on ${b.label}`;
}
