import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { ANIME_TIERS, AnimeTierResult, ROMAN } from '@/constants/animeTiers';
import { STRENGTH_STANDARDS } from '@/constants/strengthStandards';

interface Props {
  visible: boolean;
  onClose: () => void;
  result: AnimeTierResult | null;
  bodyweightLbs?: number;
}

// Given a minScore (e.g. 1.75), calculate the interpolated lb requirement
// for a given exercise at a given bodyweight
function lbsForScore(exerciseKey: string, minScore: number, bw: number): number | null {
  const std = STRENGTH_STANDARDS[exerciseKey];
  if (!std || std.type !== 'bodyweight_multiplier') return null;
  const tiers = ['beginner', 'bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;
  const lower = Math.floor(minScore);
  const frac = minScore - lower;
  const lowerMultiplier = std.thresholds[tiers[Math.min(lower, 5)]];
  const upperMultiplier = std.thresholds[tiers[Math.min(lower + 1, 5)]];
  const multiplier = lowerMultiplier + frac * (upperMultiplier - lowerMultiplier);
  return Math.round(multiplier * bw / 5) * 5; // round to nearest 5 lbs
}

const SBD_KEYS = [
  { key: 'barbell back squats', label: 'SQ' },
  { key: 'barbell bench press', label: 'BP' },
  { key: 'deadlifts', label: 'DL' },
];

export function TierLadderModal({ visible, onClose, result, bodyweightLbs }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const currentKey = result?.animeTier.key;
  const avgScore = result?.avgScore ?? 0;
  const actualAvg = result?.actualAvgScore ?? 0;
  const bw = bodyweightLbs ?? 185;

  const getSubTierRanges = (tierIndex: number) => {
    const tier = ANIME_TIERS[tierIndex];
    const next = ANIME_TIERS[tierIndex + 1];
    const min = tier.minScore;
    const max = next?.minScore ?? (min + 1.0);
    const step = (max - min) / 4;
    return [1, 2, 3, 4].map(sub => ({
      sub,
      min: min + (sub - 1) * step,
      max: min + sub * step,
    }));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: 20, paddingVertical: 16,
          borderBottomWidth: 1, borderBottomColor: Colors.border,
        }}>
          <View>
            <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 }}>
              Rank System
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>
              Tap any rank to see sub-tier breakdown
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontSize: 18 }}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          {[...ANIME_TIERS].reverse().map((tier) => {
            const tierIndex = ANIME_TIERS.indexOf(tier);
            const isCurrent = tier.key === currentKey;
            const isAchieved = avgScore >= tier.minScore;
            const isNext = !isAchieved && tierIndex === ANIME_TIERS.findIndex(t => t.key === currentKey) + 1;
            const isExpanded = expandedKey === tier.key;
            const subRanges = getSubTierRanges(tierIndex);

            return (
              <TouchableOpacity
                key={tier.key}
                activeOpacity={0.85}
                onPress={() => setExpandedKey(isExpanded ? null : tier.key)}
                style={{
                  backgroundColor: isCurrent ? tier.color + '15' : Colors.surface,
                  borderRadius: 16,
                  padding: 18,
                  borderWidth: isCurrent ? 2 : 1,
                  borderColor: isCurrent ? tier.color : isAchieved ? tier.color + '30' : Colors.border,
                  opacity: isAchieved ? 1 : 0.5,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                  {/* Tier circle */}
                  <View style={{
                    width: 48, height: 48, borderRadius: 24,
                    backgroundColor: tier.color + '20',
                    borderWidth: 2,
                    borderColor: tier.color + (isAchieved ? 'CC' : '40'),
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isAchieved && (
                      <Text style={{ color: tier.color, fontSize: 20, fontWeight: '900' }}>✓</Text>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: tier.color, fontSize: 16, fontWeight: '900', letterSpacing: 1 }}>
                        {tier.label}{isCurrent && result?.subTier ? ` ${ROMAN[result.subTier]}` : ''}
                      </Text>
                      {isCurrent && (
                        <View style={{ backgroundColor: tier.color + '25', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ color: tier.color, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>YOUR RANK</Text>
                        </View>
                      )}
                      {isNext && (
                        <View style={{ backgroundColor: Colors.surface2, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ color: Colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>NEXT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>
                      SBD avg ≥ {tier.minScore.toFixed(2)} · tap to expand
                    </Text>
                  </View>
                  <Text style={{ color: Colors.textMuted, fontSize: 16 }}>{isExpanded ? '▲' : '▼'}</Text>
                </View>

                <Text style={{
                  color: isCurrent ? Colors.text : Colors.textSecondary,
                  fontSize: 13, fontStyle: 'italic', lineHeight: 20,
                }}>
                  "{tier.tagline}"
                </Text>

                {/* Lb requirements at user's bodyweight */}
                {(() => {
                  const targets = SBD_KEYS.map(ex => ({
                    label: ex.label,
                    lbs: lbsForScore(ex.key, tier.minScore, bw),
                  })).filter(t => t.lbs !== null && t.lbs > 0);
                  if (targets.length === 0) return null;
                  return (
                    <View style={{
                      marginTop: 10, flexDirection: 'row', gap: 8,
                      backgroundColor: tier.color + '10',
                      borderRadius: 8, padding: 10,
                      borderWidth: 1, borderColor: tier.color + '25',
                    }}>
                      <Text style={{ color: Colors.textMuted, fontSize: 10, alignSelf: 'center' }}>
                        At {bw} lbs:
                      </Text>
                      {targets.map(t => (
                        <View key={t.label} style={{ alignItems: 'center', flex: 1 }}>
                          <Text style={{ color: tier.color, fontSize: 14, fontWeight: '900' }}>{t.lbs}</Text>
                          <Text style={{ color: Colors.textMuted, fontSize: 9, marginTop: 1 }}>{t.label}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                {/* Progress bar for current tier */}
                {isCurrent && result?.nextAnimeTier && (
                  <View style={{ marginTop: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: Colors.textMuted, fontSize: 10 }}>Progress to {result.nextAnimeTier.label}</Text>
                      <Text style={{ color: tier.color, fontSize: 10, fontWeight: '700' }}>
                        {avgScore.toFixed(2)} / {result.nextAnimeTier.minScore.toFixed(2)}
                      </Text>
                    </View>
                    <View style={{ height: 4, backgroundColor: Colors.surface2, borderRadius: 2 }}>
                      <View style={{
                        height: '100%', borderRadius: 2, backgroundColor: tier.color,
                        width: `${Math.min(((avgScore - tier.minScore) / (result.nextAnimeTier.minScore - tier.minScore)) * 100, 100)}%`,
                      }} />
                    </View>
                  </View>
                )}

                {/* Expanded: sub-tier breakdown */}
                {isExpanded && (
                  <View style={{ marginTop: 14, gap: 8 }}>
                    <View style={{ height: 1, backgroundColor: tier.color + '30', marginBottom: 2 }} />
                    <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
                      Sub-Tier Breakdown
                    </Text>
                    {subRanges.map(({ sub, min, max }) => {
                      const isUserHere = isCurrent && result?.subTier === sub;
                      return (
                        <View key={sub} style={{
                          flexDirection: 'row', alignItems: 'center', gap: 12,
                          backgroundColor: isUserHere ? tier.color + '20' : Colors.surface2,
                          borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
                          borderWidth: 1,
                          borderColor: isUserHere ? tier.color : Colors.border,
                        }}>
                          <View style={{
                            width: 32, height: 32, borderRadius: 16,
                            backgroundColor: tier.color + (isUserHere ? '30' : '15'),
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Text style={{ color: tier.color, fontSize: 12, fontWeight: '900' }}>
                              {ROMAN[sub]}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: isUserHere ? tier.color : Colors.text, fontSize: 13, fontWeight: '700' }}>
                              {tier.label} {ROMAN[sub]}
                              {isUserHere ? '  ← you are here' : ''}
                            </Text>
                            <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>
                              Weakest SBD lift: {min.toFixed(2)}–{max.toFixed(2)} avg score
                            </Text>
                          </View>
                          {/* Mini sub-tier progress for current */}
                          {isUserHere && (
                            <View style={{
                              backgroundColor: tier.color + '25',
                              borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3,
                            }}>
                              <Text style={{ color: tier.color, fontSize: 9, fontWeight: '900' }}>ACTIVE</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                    {isCurrent && result?.bottleneck && result.bottleneck.nextTierWeight && result.bottleneck.weight > 0 && (
                      <View style={{
                        backgroundColor: Colors.surface, borderRadius: 10, padding: 12,
                        borderWidth: 1, borderColor: tier.color + '30', marginTop: 4,
                      }}>
                        <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                          What's holding you back
                        </Text>
                        <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700' }}>
                          {result.bottleneck.label}: +{Math.ceil(result.bottleneck.nextTierWeight - result.bottleneck.weight)} lbs
                          {' '}to reach the next tier
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* How it works */}
          <View style={{
            backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
            borderWidth: 1, borderColor: Colors.border, marginTop: 8, gap: 12,
          }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              How Ranks Work
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
              Your rank is your <Text style={{ color: Colors.text, fontWeight: '700' }}>weakest SBD lift</Text>. A 400 squat and 400 deadlift won't move you past NINJA if your bench is still at NINJA level. Every lift has to earn the rank.
            </Text>
            <View style={{ height: 1, backgroundColor: Colors.border }} />
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              The I · II · III · IV System
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
              Every tier has four sub-ranks. <Text style={{ color: Colors.text, fontWeight: '700' }}>NINJA I → NINJA II → NINJA III → NINJA IV → DEMON I</Text>.{'\n\n'}Sub-tiers measure your <Text style={{ color: Colors.text, fontWeight: '700' }}>average</Text> across all three lifts — so even when your weakest lift is holding your rank, you can still feel progress climbing through the sub-tiers as your other lifts improve.{'\n\n'}Hit a new PR on any SBD lift and watch for the advance screen.
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingTop: 4 }}>
              {['I', 'II', 'III', 'IV'].map((r, i) => (
                <View key={r} style={{
                  backgroundColor: Colors.accent + (i === 1 ? '30' : '15'),
                  borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5,
                  borderWidth: 1, borderColor: Colors.accent + '30',
                }}>
                  <Text style={{ color: Colors.accent, fontSize: 11, fontWeight: '900' }}>{r}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
