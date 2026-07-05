import { View, Text } from 'react-native';
import { Colors, TierName } from '@/constants/colors';
import { TIER_LABELS, TIER_ORDER } from '@/constants/strengthStandards';
import type { RankResult } from '@/constants/ranks';

const TIER_COLORS: Record<TierName, string> = {
  beginner: Colors.tiers.beginner,
  bronze: Colors.tiers.bronze,
  silver: Colors.tiers.silver,
  gold: Colors.tiers.gold,
  platinum: Colors.tiers.platinum,
  diamond: Colors.tiers.diamond,
};

export interface MuscleGroupTier {
  group: string;
  tier: TierName;
  bestLift: string;
  weight: number;
}

// Per-lift SBD strength bars. Renders nothing until at least one lift is logged.
export function SbdStrengthCard({ result }: { result: RankResult }) {
  if (!result.lifts.some(l => l.weight > 0)) return null;
  return (
    <View style={{ backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
      <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
        SBD Strength
      </Text>
      {result.lifts.map((lift, i) => {
        const pct = Math.min(lift.tierScore / 5, 1);
        const hasData = lift.weight > 0;
        return (
          <View key={i} style={{ marginBottom: i < 2 ? 12 : 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '800', width: 24 }}>{lift.label}</Text>
                {hasData && <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>{lift.weight} lbs</Text>}
              </View>
              {hasData ? (
                <View style={{ backgroundColor: TIER_COLORS[lift.tier] + '20', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: TIER_COLORS[lift.tier], fontSize: 10, fontWeight: '800' }}>{TIER_LABELS[lift.tier].toUpperCase()}</Text>
                </View>
              ) : (
                <Text style={{ color: Colors.textMuted, fontSize: 11 }}>not logged</Text>
              )}
            </View>
            <View style={{ height: 5, backgroundColor: Colors.surface2, borderRadius: 3, overflow: 'hidden' }}>
              <View style={{
                height: '100%', width: `${(hasData ? pct : 0.02) * 100}%`,
                backgroundColor: hasData ? TIER_COLORS[lift.tier] : Colors.border, borderRadius: 3,
              }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// Per-muscle-group rank grid. Renders nothing when there are no ranked groups.
export function BodyPartRanksCard({ tiers }: { tiers: MuscleGroupTier[] }) {
  if (!tiers || tiers.length === 0) return null;
  return (
    <View style={{ backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
      <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
        Body Part Ranks
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tiers.map((mg, i) => {
          const tc = TIER_COLORS[mg.tier];
          return (
            <View key={i} style={{
              width: '47%', backgroundColor: tc + '10', borderRadius: 12, padding: 12,
              borderWidth: 1, borderColor: tc + '40', gap: 4,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>{mg.group}</Text>
                <View style={{ backgroundColor: tc + '25', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                  <Text style={{ color: tc, fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>{TIER_LABELS[mg.tier].toUpperCase()}</Text>
                </View>
              </View>
              <Text style={{ color: Colors.textMuted, fontSize: 10 }} numberOfLines={1}>{mg.bestLift}</Text>
              <Text style={{ color: tc, fontSize: 13, fontWeight: '800' }}>{mg.weight} lbs</Text>
              <View style={{ height: 3, backgroundColor: Colors.surface2, borderRadius: 2, marginTop: 4 }}>
                <View style={{ height: '100%', width: `${(TIER_ORDER.indexOf(mg.tier) / 5) * 100}%`, backgroundColor: tc, borderRadius: 2 }} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
