import { StyleSheet, View } from 'react-native';
import { AppText, Section } from '@/components/ui';
import { formatPower } from '@/components/anime';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { CANONICAL_LIFTS, describeSource, type PowerReading } from '@/lib/powerLevel';
import type { WeightUnit } from '@/lib/units';

interface Props {
  reading: PowerReading;
  unit: WeightUnit;
  /** "Set a known max" entry point */
  onSetKnownMax?: () => void;
}

/** Where each number came from — "Bench 245 est. from 225 × 3, Oct 28". Keeps the reading trustworthy. */
export function PowerBreakdown({ reading, unit, onSetKnownMax }: Props) {
  return (
    <Section
      title="Power level sources"
      action={onSetKnownMax ? { label: 'Set a known max', onPress: onSetKnownMax } : undefined}
    >
      <View style={styles.list}>
        {CANONICAL_LIFTS.map((lift, i) => {
          const e = reading.lifts[lift];
          return (
            <View key={lift} style={[styles.row, i > 0 && styles.divider]}>
              <View style={styles.flex}>
                <AppText variant="heading" style={styles.title}>{describeSource(lift, e, unit)}</AppText>
                {e.source === 'proxy' && <AppText variant="caption">Proxy estimate — log the lift itself for a full reading</AppText>}
              </View>
              {reading.weakest === lift && <AppText variant="caption" color={Colors.text}>Weakest</AppText>}
            </View>
          );
        })}
      </View>
      <AppText variant="caption">
        {reading.confidence === 'calibrating'
          ? 'No squat, bench, or deadlift data in the last 180 days.'
          : `Power level ${reading.confidence === 'partial' ? '≈' : ''}${formatPower(reading.power)} · average of your lifts. Rank follows your weakest lift.`}
      </AppText>
    </Section>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, minHeight: 56 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.border },
  flex: { flex: 1, gap: 2 },
  title: { fontSize: 15 },
});
