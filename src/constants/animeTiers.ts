import { TierName } from './colors';
import { getTierForWeight, TIER_ORDER, STRENGTH_STANDARDS } from './strengthStandards';

export interface AnimeTier {
  key: 'civilian' | 'training_arc' | 'tournament_arc' | 'rival_level' | 'final_boss' | 'god_tier';
  label: string;
  tagline: string;
  color: string;
  minScore: number; // average tier score needed
}

// Coach personality per tier — same AI, different energy
export const TIER_COACH_PERSONALITY: Record<string, string> = {
  civilian: "You're speaking to a lifter early in their journey. Be encouraging and foundational. Build their confidence. Don't overwhelm — focus on habits and basics.",
  training_arc: "This lifter is building something real. Push them harder than they push themselves. Be direct, be motivating. They can handle honest feedback.",
  tournament_arc: "Technical territory. Speak to programming concepts — RPE, volume landmarks, weak point training. This lifter wants to understand the why, not just the what.",
  rival_level: "This athlete has transcended most lifters. Cold analysis, no hand-holding. Peer-level conversation. Call out what others won't.",
  final_boss: "S-rank mentality. Surgical feedback. Precise programming. This lifter operates at a level most never reach. Respect it and match it.",
  god_tier: "Saiyan level. You are speaking to someone who has broken the ceiling. Assume elite knowledge. No basics, no encouragement needed — just pure precision.",
};

export const TIER_COACH_NAME: Record<string, string> = {
  civilian: 'NINJA Sensei',
  training_arc: 'DEMON Sensei',
  tournament_arc: 'SORCERERS Sensei',
  rival_level: 'HOLLOW Sensei',
  final_boss: 'SOLO Sensei',
  god_tier: 'WARRIOR Sensei',
};

export const ANIME_TIERS: AnimeTier[] = [
  {
    key: 'civilian',
    label: 'NINJA',
    tagline: "Every legend had a day one. This is yours. Keep showing up.",
    color: '#F97316',       // Naruto orange
    minScore: 0,
  },
  {
    key: 'training_arc',
    label: 'DEMON',
    tagline: "You've unlocked something. The real training starts now.",
    color: '#EF4444',       // Tanjiro / Demon Slayer red
    minScore: 0.75,
  },
  {
    key: 'tournament_arc',
    label: 'SORCERERS',
    tagline: "Limitless. You see things most lifters never will.",
    color: '#818CF8',       // Gojo blue-purple
    minScore: 1.75,
  },
  {
    key: 'rival_level',
    label: 'HOLLOW',
    tagline: "You've transcended. The power isn't borrowed anymore — it's yours.",
    color: '#38BDF8',       // Bleach — hollow white-blue
    minScore: 2.75,
  },
  {
    key: 'final_boss',
    label: 'SOLO',
    tagline: "You arose alone. S-rank. The gap between you and others is silent.",
    color: '#A78BFA',       // Jin Woo dark purple
    minScore: 3.75,
  },
  {
    key: 'god_tier',
    label: 'WARRIOR',
    tagline: "Saiyan level. There is no ceiling because you already broke it.",
    color: '#FBBF24',       // Super Saiyan gold
    minScore: 4.75,
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
  avgScore: number;      // weakest-link rank score (used for competitive rank)
  actualAvgScore: number; // true average across logged lifts (used for sub-tier)
  subTier: number;        // 1-4 progress within current anime tier
  lifts: SBDResult[];
  bottleneck: SBDResult | null; // the weakest lift holding overall tier back
}

// Roman numerals for sub-tier display
export const ROMAN = ['', 'I', 'II', 'III', 'IV'] as const;

export function getAnimeTierResult(
  prs: { exerciseName: string; weight: number; reps: number; achievedAt?: string }[],
  bodyweightLbs: number,
  useDecay = false  // if true, only count PRs from last 6 months for rank
): AnimeTierResult {
  const bw = bodyweightLbs || 185;
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400000);

  const lifts: SBDResult[] = SBD_EXERCISES.map(ex => {
    // For ranking: use recent PR if decay enabled, else use best overall
    const allMatching = prs.filter(p => p.exerciseName.toLowerCase() === ex.key);
    const recentMatching = useDecay
      ? allMatching.filter(p => !p.achievedAt || new Date(p.achievedAt) >= sixMonthsAgo)
      : allMatching;

    const pr = recentMatching.length > 0 ? recentMatching[0] : null;
    const weight = pr ? pr.weight : 0;
    const tier = getTierForWeight(ex.name, weight, bw);
    const tierScore = TIER_ORDER.indexOf(tier);

    const standard = STRENGTH_STANDARDS[ex.key];
    let nextTierWeight: number | null = null;
    if (standard && tierScore < 5) {
      const nextTierName = TIER_ORDER[tierScore + 1];
      const nextThreshold = standard.thresholds[nextTierName];
      nextTierWeight = standard.type === 'bodyweight_multiplier'
        ? Math.ceil(nextThreshold * bw)
        : nextThreshold;
    }

    return { exercise: ex.name, label: ex.label, weight, tier, tierScore, nextTierWeight };
  });

  const loggedLifts = lifts.filter(l => l.weight > 0);

  // ── WEAKEST LINK RULE ─────────────────────────────────────────────────────
  // Rank = your lowest SBD tier. Can't hide a weak lift.
  const rankScore = loggedLifts.length > 0
    ? Math.min(...loggedLifts.map(l => l.tierScore))
    : 0;

  // True average — used for sub-tier display (not gated by weakest link)
  const actualAvgScore = loggedLifts.length > 0
    ? loggedLifts.reduce((s, l) => s + l.tierScore, 0) / loggedLifts.length
    : 0;

  let animeTier = ANIME_TIERS[0];
  for (const at of ANIME_TIERS) {
    if (rankScore >= at.minScore) animeTier = at;
  }

  const nextAnimeTier = ANIME_TIERS.find(at => at.minScore > rankScore) ?? null;

  // ── SUB-TIER (1-4) within current anime tier ──────────────────────────────
  // Measures progress through the tier using the actual average score,
  // so logging a new lift at a lower level doesn't collapse your sub-tier.
  const currentMinScore = animeTier.minScore;
  const nextMinScore = nextAnimeTier?.minScore ?? (currentMinScore + 1.0);
  const rangeSize = nextMinScore - currentMinScore;
  const posInRange = rangeSize > 0
    ? Math.max(0, (actualAvgScore - currentMinScore) / rangeSize)
    : 1;
  const subTier = Math.min(4, Math.max(1, Math.floor(posInRange * 4) + 1));

  // Bottleneck = the weakest lift (what's holding rank back)
  const bottleneck = loggedLifts.length > 0
    ? [...lifts].sort((a, b) => a.tierScore - b.tierScore)[0]
    : null;

  return { animeTier, nextAnimeTier, avgScore: rankScore, actualAvgScore, subTier, lifts, bottleneck };
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
