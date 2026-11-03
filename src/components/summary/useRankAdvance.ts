import { useMemo } from 'react';
import { RANK_TIERS, type RankTier } from '@/constants/ranks';
import { Colors } from '@/constants/colors';
import { TIER_LABELS, TIER_ORDER } from '@/constants/strengthStandards';
import type { SummaryPower } from './types';

export interface RankAdvance {
  tier: RankTier;
  subTier?: number;
  isSubTierAdvance: boolean;
  liftName?: string;
  liftTierName?: string;
  liftTierColor?: string;
  /** Tier key before, when the WORLD changed (two-beat cameo handoff) */
  worldChangedFrom: string | null;
}

const LIFT_NAMES = ['SQUAT', 'BENCH PRESS', 'DEADLIFT'];
const idx = (key: string) => RANK_TIERS.findIndex(t => t.key === key);

/**
 * Same advancement cases TierAdvancementScreen always handled (first rank,
 * full rank, sub-tier, single-lift tier), now detected once on finish from
 * the before/after Power Level readings instead of per PR set.
 */
export function useRankAdvance(power: SummaryPower | null | undefined): RankAdvance | null {
  return useMemo(() => {
    const after = power?.afterRank;
    if (!after) return null;
    const before = power?.beforeRank;
    const tier = RANK_TIERS[idx(after.key)];
    if (!tier) return null;

    if (!before) {
      return { tier, subTier: after.sub, isSubTierAdvance: false, worldChangedFrom: null };
    }
    if (idx(after.key) > idx(before.key)) {
      return { tier, isSubTierAdvance: false, worldChangedFrom: before.key };
    }
    if (after.key === before.key && after.sub > before.sub) {
      return { tier, subTier: after.sub, isSubTierAdvance: true, worldChangedFrom: null };
    }
    for (let i = 0; i < 3; i++) {
      const b = TIER_ORDER.indexOf(before.lifts[i]);
      const a = TIER_ORDER.indexOf(after.lifts[i]);
      if (a > b && a > 0) {
        const tn = after.lifts[i];
        return {
          tier, isSubTierAdvance: false, worldChangedFrom: null,
          liftName: LIFT_NAMES[i],
          liftTierName: TIER_LABELS[tn].toUpperCase(),
          liftTierColor: Colors.tiers[tn],
        };
      }
    }
    return null;
  }, [power]);
}
