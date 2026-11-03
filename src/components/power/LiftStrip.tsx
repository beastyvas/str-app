import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { CANONICAL_LIFTS, type PowerReading } from '@/lib/powerLevel';

const LABEL = { squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift' } as const;
// Bars fill against Godhand IV (p = 24); past that they're simply full.
const MAX_P = 24;

/** Three segments — squat / bench / deadlift positions. The weakest is visibly shorter. */
export function LiftStrip({ reading, color }: { reading: PowerReading; color: string }) {
  return (
    <View style={styles.row}>
      {CANONICAL_LIFTS.map(lift => {
        const p = reading.lifts[lift].p;
        const pct = p == null ? 0 : Math.max(0.04, Math.min(1, p / MAX_P));
        const weakest = reading.weakest === lift;
        return (
          <View key={lift} style={styles.seg}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: weakest ? color + '80' : color }]} />
            </View>
            <AppText variant="caption" color={weakest ? Colors.text : Colors.textMuted}>
              {LABEL[lift]}{p == null ? ' · —' : ''}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, alignSelf: 'stretch' },
  seg: { flex: 1, gap: Spacing.xs },
  track: { height: 6, backgroundColor: Colors.surface3, overflow: 'hidden' },
  fill: { height: '100%' },
});
