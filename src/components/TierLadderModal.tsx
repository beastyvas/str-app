import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, TierName } from '@/constants/colors';
import { ANIME_TIERS, AnimeTierResult, ROMAN } from '@/constants/animeTiers';

interface Props {
  visible: boolean;
  onClose: () => void;
  result: AnimeTierResult | null;
}

const TIER_COLORS: Record<TierName, string> = {
  beginner: Colors.tiers.beginner,
  bronze: Colors.tiers.bronze,
  silver: Colors.tiers.silver,
  gold: Colors.tiers.gold,
  platinum: Colors.tiers.platinum,
  diamond: Colors.tiers.diamond,
};

// SBD average score needed per anime tier (maps to tier index)
const SCORE_LABELS = ['0.0', '0.5', '1.5', '2.5', '3.5', '4.5'];

export function TierLadderModal({ visible, onClose, result }: Props) {
  const currentKey = result?.animeTier.key;
  const avgScore = result?.avgScore ?? 0;

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
              Based on your SBD strength relative to bodyweight
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontSize: 18 }}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          {[...ANIME_TIERS].reverse().map((tier, i) => {
            const isCurrent = tier.key === currentKey;
            const isAchieved = avgScore >= tier.minScore;
            const isNext = !isAchieved && ANIME_TIERS.indexOf(tier) === ANIME_TIERS.findIndex(t => t.key === currentKey) + 1;

            return (
              <View
                key={tier.key}
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
                      <Text style={{
                        color: tier.color,
                        fontSize: 16, fontWeight: '900', letterSpacing: 1,
                      }}>
                        {tier.label}{isCurrent && result?.subTier ? ` ${ROMAN[result.subTier]}` : ''}
                      </Text>
                      {isCurrent && (
                        <View style={{
                          backgroundColor: tier.color + '25',
                          borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2,
                        }}>
                          <Text style={{ color: tier.color, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>
                            YOUR RANK
                          </Text>
                        </View>
                      )}
                      {isNext && (
                        <View style={{
                          backgroundColor: Colors.surface2,
                          borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2,
                        }}>
                          <Text style={{ color: Colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>
                            NEXT
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>
                      SBD avg ≥ {tier.minScore.toFixed(1)} / 5.0
                    </Text>
                  </View>
                </View>

                <Text style={{
                  color: isCurrent ? Colors.text : Colors.textSecondary,
                  fontSize: 13,
                  fontStyle: 'italic',
                  lineHeight: 20,
                }}>
                  "{tier.tagline}"
                </Text>

                {/* Progress bar for current tier */}
                {isCurrent && result?.nextAnimeTier && (
                  <View style={{ marginTop: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: Colors.textMuted, fontSize: 10 }}>Progress to {result.nextAnimeTier.label}</Text>
                      <Text style={{ color: tier.color, fontSize: 10, fontWeight: '700' }}>
                        {avgScore.toFixed(1)} / {result.nextAnimeTier.minScore.toFixed(1)}
                      </Text>
                    </View>
                    <View style={{ height: 4, backgroundColor: Colors.surface2, borderRadius: 2 }}>
                      <View style={{
                        height: '100%',
                        borderRadius: 2,
                        backgroundColor: tier.color,
                        width: `${Math.min(((avgScore - tier.minScore) / (result.nextAnimeTier.minScore - tier.minScore)) * 100, 100)}%`,
                      }} />
                    </View>
                  </View>
                )}
              </View>
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
            <View style={{
              flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
              paddingTop: 4,
            }}>
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
