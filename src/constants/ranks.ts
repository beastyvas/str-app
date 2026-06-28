import { TierName } from './colors';
import { getTierForWeight, TIER_ORDER, getLiftTierResult, getScaledThresholds, type Lift, type Gender } from './strengthStandards';

export interface RankTier {
  key: 'mortal' | 'awakened' | 'ascendant' | 'phantom' | 'sovereign' | 'godhand';
  label: string;
  tagline: string;
  color: string;
  minScore: number; // average tier score needed
}

// Coach personality per tier — same AI, different energy
export const TIER_COACH_PERSONALITY: Record<string, string> = {
  mortal: "You're speaking to a lifter at the very start of their journey. Be warm, protective, and foundational — this may be someone nervous or intimidated by the gym. Build their confidence, focus on habits and basics, and never overwhelm them. They showed up; that's the hardest part.",
  awakened: "This lifter has unlocked something real. The training wheels come off. Push them harder than they push themselves — be direct, motivating, and honest. They're not new anymore and can handle real feedback.",
  ascendant: "Technical territory. Speak to programming concepts — RPE, volume landmarks, weak-point training. This lifter wants to understand the WHY, not just the what. Respect their hunger to understand the mechanics.",
  phantom: "This athlete has surpassed most lifters. Cold analysis, no hand-holding, peer-level conversation. Call out what others won't. The warmth is mostly gone — they've earned blunt truth over comfort.",
  sovereign: "S-rank mentality. Surgical feedback, precise programming. This lifter operates at a level most never reach. Match it, respect it, and waste no words.",
  godhand: "This lifter broke the ceiling. Assume elite knowledge — no basics, no encouragement needed, pure precision. You're speaking to a force of nature as an equal. There's nothing left to teach, only to sharpen.",
};

export const TIER_COACH_NAME: Record<string, string> = {
  mortal: 'The Mentor',
  awakened: 'The Trainer',
  ascendant: 'The Tactician',
  phantom: 'The Rival',
  sovereign: 'The Sovereign',
  godhand: 'The Limitless',
};

export const RANK_TIERS: RankTier[] = [
  {
    key: 'mortal',
    label: 'MORTAL',
    tagline: "Every legend had a day one. This is yours. Keep showing up.",
    color: '#F97316',
    minScore: 0,
  },
  {
    key: 'awakened',
    label: 'AWAKENED',
    tagline: "You've crossed the threshold. The real training starts now.",
    color: '#EF4444',
    minScore: 0.75,
  },
  {
    key: 'ascendant',
    label: 'ASCENDANT',
    tagline: "You're rising above the rest. Now you'll see what most never do.",
    color: '#818CF8',
    minScore: 1.75,
  },
  {
    key: 'phantom',
    label: 'PHANTOM',
    tagline: "You've transcended the physical. The power is yours now.",
    color: '#38BDF8',
    minScore: 2.75,
  },
  {
    key: 'sovereign',
    label: 'SOVEREIGN',
    tagline: "You rule your domain. S-rank. The gap between you and others is silent.",
    color: '#A78BFA',
    minScore: 3.75,
  },
  {
    key: 'godhand',
    label: 'GODHAND',
    tagline: "You broke the ceiling. There is no limit left — only the blade to sharpen.",
    color: '#FBBF24',
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

export interface RankResult {
  tier: RankTier;
  nextTier: RankTier | null;
  avgScore: number;      // weakest-link rank score (used for competitive rank)
  actualAvgScore: number; // true average across logged lifts (used for sub-tier)
  subTier: number;        // 1-4 progress within current rank tier
  lifts: SBDResult[];
  bottleneck: SBDResult | null; // the weakest lift holding overall tier back
}

// Roman numerals for sub-tier display
export const ROMAN = ['', 'I', 'II', 'III', 'IV'] as const;

export function getRankResult(
  prs: { exerciseName: string; weight: number; reps: number; achievedAt?: string }[],
  bodyweightLbs: number,
  useDecay = false,
  gender: 'male' | 'female' | 'other' | null = 'male'
): RankResult {
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

  const tier = RANK_TIERS[Math.min(rankScore, 5)];
  const nextTier = rankScore < 5 ? RANK_TIERS[rankScore + 1] : null;

  // avgScore: progress within rank as 0.0–1.0 fraction for progress bar
  const posInRank = weakestScore24 >= 0 ? (weakestScore24 % 4) / 4 : 0;
  const actualAvgScore = rankScore + posInRank;

  // Bottleneck = weakest lift by 24-point score
  const bottleneck = weakestLift ?? null;

  return { tier, nextTier, avgScore: rankScore, actualAvgScore, subTier, lifts, bottleneck };
}

// How much each lift needs to increase for the next rank tier
export function getNextTierGap(result: RankResult): string | null {
  if (!result.nextTier || !result.bottleneck) return null;
  const b = result.bottleneck;
  if (!b.nextTierWeight || b.weight <= 0) return null;
  const gap = b.nextTierWeight - b.weight;
  if (gap <= 0) return null;
  return `+${gap} lbs on ${b.label}`;
}
