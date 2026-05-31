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
  avgScore: number;
  lifts: SBDResult[];
  bottleneck: SBDResult | null; // the weakest lift holding overall tier back
}

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

  // avgScore still shown for display purposes
  const avgScore = loggedLifts.length > 0
    ? loggedLifts.reduce((s, l) => s + l.tierScore, 0) / loggedLifts.length
    : 0;

  let animeTier = ANIME_TIERS[0];
  for (const at of ANIME_TIERS) {
    if (rankScore >= at.minScore) animeTier = at;
  }

  const nextAnimeTier = ANIME_TIERS.find(at => at.minScore > rankScore) ?? null;

  // Bottleneck = the weakest lift (what's holding rank back)
  const bottleneck = loggedLifts.length > 0
    ? [...lifts].sort((a, b) => a.tierScore - b.tierScore)[0]
    : null;

  return { animeTier, nextAnimeTier, avgScore: rankScore, lifts, bottleneck };
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
