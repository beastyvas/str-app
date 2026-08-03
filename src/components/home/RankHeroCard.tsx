import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Radius, Shadow, Spacing } from '@/constants/theme';
import { AppText, PressableScale } from '@/components/ui';
import { getNextTierGap, RankResult, ROMAN } from '@/constants/ranks';

interface RankHeroCardProps {
  rankResult: RankResult;
  onOpenLadder: () => void;
  /** Called with the pre-built bottleneck question */
  onAskCoach: (question: string) => void;
}

export function RankHeroCard({ rankResult, onOpenLadder, onAskCoach }: RankHeroCardProps) {
  const tierColor = rankResult.tier.color;
  const gap = getNextTierGap(rankResult);
  const progress = Math.max(0, Math.min(1, rankResult.avgScore / 5));

  return (
    <PressableScale onPress={onOpenLadder} scaleTo={0.98} style={styles.wrap}>
      <View style={[styles.card, { borderColor: tierColor + '35' }, Shadow.card]}>
        <LinearGradient
          colors={Gradients.tierWash(tierColor)}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.topRow}>
          <View style={styles.left}>
            <AppText variant="overline" color={tierColor}>
              {rankResult.tier.label} {ROMAN[rankResult.subTier]}
            </AppText>
            <AppText variant="caption" style={styles.tagline} numberOfLines={1}>
              "{rankResult.tier.tagline}"
            </AppText>
          </View>
          <View style={styles.scoreCol}>
            <AppText variant="statValue" color={tierColor}>
              {rankResult.avgScore.toFixed(1)}
            </AppText>
            <AppText variant="micro">/ 5.0</AppText>
          </View>
        </View>

        {/* Progress toward the top of the ladder */}
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: tierColor }]} />
        </View>

        {gap && (
          <View style={styles.gapRow}>
            <AppText variant="micro" style={styles.gapText}>
              {gap.replace('+', '').replace(' lbs on ', ' lbs needed on ').replace(/(\w+)$/, '$1 to rank up')}
            </AppText>
            <PressableScale
              haptic="light"
              onPress={() => {
                const q = `My ${rankResult.bottleneck!.exercise} is my weakest SBD lift at ${rankResult.bottleneck!.weight} lbs. What's the most effective way to bring it up? Give me a real program adjustment.`;
                onAskCoach(q);
              }}
              style={[styles.coachChip, { backgroundColor: tierColor + '25' }]}
            >
              <AppText variant="micro" color={tierColor} style={styles.coachChipText}>
                Ask Coach ⚡
              </AppText>
            </PressableScale>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md + 2 },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    gap: Spacing.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  left: { flex: 1, gap: 3 },
  tagline: { fontStyle: 'italic', color: Colors.textSecondary },
  scoreCol: { alignItems: 'flex-end' },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.surface2,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  gapRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  gapText: { flex: 1 },
  coachChip: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  coachChipText: { fontWeight: '800' },
});
