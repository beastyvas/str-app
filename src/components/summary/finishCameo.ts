import AsyncStorage from '@react-native-async-storage/async-storage';
import { RANK_TIERS, ROMAN } from '@/constants/ranks';
import type { TierKey } from '@/constants/cast';
import { FINISH_PRIORITY, type CameoTrigger } from '@/lib/cameoEngine';
import { showCameo, useCameoStore } from '@/components/cameo/useCameoStore';
import { formatPower } from '@/components/anime/PowerReadout';
import type { FinishCameoFacts } from '@/lib/workoutCameos';
import type { SummaryPower } from './types';
import type { RankAdvance } from './useRankAdvance';

/**
 * At finish exactly ONE cameo shows, by priority:
 * over_9000 > rank_up > heavy_day > power_jump > sub_rank_up > comeback > workout_finished.
 * Call after the Power Level reveal (or after TierAdvancementScreen closes
 * when there was a rank change).
 */
export async function fireFinishCameo(opts: {
  userId: string | undefined;
  name: string;
  power: SummaryPower | null;
  advance: RankAdvance | null;
  facts: FinishCameoFacts | null;
}) {
  const { userId, name, power, advance, facts } = opts;
  const before = power?.before ?? null;
  const after = power?.after ?? null;
  const delta = before != null && after != null ? after - before : null;

  let over9000 = false;
  if (userId && after != null && after > 9000 && (before == null || before <= 9000)) {
    const k = `cameo_over9000_${userId}`;
    try {
      if ((await AsyncStorage.getItem(k)) !== 'fired') {
        over9000 = true;
        await AsyncStorage.setItem(k, 'fired');
      }
    } catch { /* storage unavailable: skip the once-ever moment */ }
  }

  const candidates: Record<CameoTrigger | 'rank_up', boolean> = {
    over_9000: over9000,
    rank_up: !!advance?.worldChangedFrom,
    heavy_day: !!facts?.heavy,
    power_jump: delta != null && delta >= 50,
    sub_rank_up: !!advance?.isSubTierAdvance,
    comeback: facts?.comebackDays != null,
    workout_finished: true,
  } as Record<CameoTrigger | 'rank_up', boolean>;

  const tier = power?.afterRank ? RANK_TIERS.find(t => t.key === power.afterRank!.key) : null;
  const vars = {
    name,
    power: after != null ? formatPower(after) : undefined,
    delta: delta != null && delta > 0 ? formatPower(delta) : undefined,
    rank: tier ? tier.label.charAt(0) + tier.label.slice(1).toLowerCase() : undefined,
    sub: power?.afterRank ? ROMAN[power.afterRank.sub] : undefined,
    days: facts?.comebackDays ?? undefined,
  };

  for (const trigger of FINISH_PRIORITY) {
    if (!candidates[trigger]) continue;
    const shown = showCameo(trigger, vars, {
      extras: trigger === 'rank_up' ? { fromTier: advance!.worldChangedFrom as TierKey } : undefined,
    });
    if (trigger === 'rank_up') useCameoStore.getState().markRankUpDay();
    if (shown) return;
  }
}
