import { TierName } from './colors';
import { getTierForWeight, TIER_ORDER, getLiftTierResult, getScaledThresholds, type Lift, type Gender } from './strengthStandards';

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
  { name: 'Barbell Back Squats', key: 'barbell back squats', label: 'SQ',
    aliases: ['squat', 'back squat', 'barbell squat', 'low bar', 'high bar', 'bb squat'] },
  { name: 'Barbell Bench Press', key: 'barbell bench press', label: 'BP',
    aliases: ['bench', 'bench press', 'flat bench', 'barbell bench', 'bb bench', 'chest press'] },
  { name: 'Deadlifts', key: 'deadlifts', label: 'DL',
    aliases: ['deadlift', 'dead lift', 'conventional deadlift', 'sumo deadlift', 'sumo', 'conv deadlift'] },
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
  useDecay = false,
  gender: 'male' | 'female' | 'other' | null = 'male'
): AnimeTierResult {
  const bw = Math.max(bodyweightLbs || 185, 50);
  const g: Gender = gender === 'female' ? 'female' : 'male';
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400000);

  // Map SBD exercise to Lift key
  const LIFT_KEYS: Record<string, Lift> = { SQ: 'squat', BP: 'bench', DL: 'deadlift' };

  const lifts: SBDResult[] = SBD_EXERCISES.map(ex => {
    const exKey = ex.key;
    const exAliases = (ex as any).aliases ?? [];
    const allMatching = prs.filter(p => {
      const n = p.exerciseName.toLowerCase();
      return n === exKey || exAliases.some((a: string) => n.includes(a));
    }).sort((a, b) => b.weight - a.weight);

    const recentMatching = useDecay
      ? allMatching.filter(p => !p.achievedAt || new Date(p.achievedAt) >= sixMonthsAgo)
      : allMatching;

    const pr = recentMatching.length > 0 ? recentMatching[0] : null;
    const weight = pr ? pr.weight : 0;

    // Use the new competition-data lookup system
    const liftResult = getLiftTierResult(LIFT_KEYS[ex.label], weight, bw, g);

    // Map rank (0-5) → TierName for backward compat
    const tierName = TIER_ORDER[Math.min(Math.max(liftResult.rank, 0), 5)];

    return {
      exercise: ex.name,
      label: ex.label,
      weight,
      tier: tierName,
      tierScore: liftResult.score >= 0 ? liftResult.rank : 0, // 0-5 rank
      nextTierWeight: liftResult.nextThreshold,
      // Extended: 24-point combined score for precise weakest-link
      _score24: liftResult.score,   // 0-23, -1 = no lift logged
      _subTier: liftResult.tier,    // 1-4 within rank
    } as any;
  });

  const loggedLifts = lifts.filter(l => l.weight > 0);

  // ── WEAKEST LINK using 24-point score ─────────────────────────────────────
  const weakestLift = loggedLifts.length > 0
    ? loggedLifts.reduce((min, l) => (l as any)._score24 < (min as any)._score24 ? l : min)
    : null;

  const weakestScore24 = weakestLift ? (weakestLift as any)._score24 : -1;
  const rankScore = weakestScore24 >= 0 ? Math.floor(weakestScore24 / 4) : 0; // 0-5
  const subTier = weakestScore24 >= 0 ? (weakestScore24 % 4) + 1 : 1;        // 1-4

  const animeTier = ANIME_TIERS[Math.min(rankScore, 5)];
  const nextAnimeTier = rankScore < 5 ? ANIME_TIERS[rankScore + 1] : null;

  // avgScore: progress within rank as 0.0–1.0 fraction for progress bar
  const posInRank = weakestScore24 >= 0 ? (weakestScore24 % 4) / 4 : 0;
  const actualAvgScore = rankScore + posInRank;

  // Bottleneck = weakest lift by 24-point score
  const bottleneck = weakestLift ?? null;

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
