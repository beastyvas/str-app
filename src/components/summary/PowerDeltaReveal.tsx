import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { MangaPanel, SfxLayer, formatPower } from '@/components/anime';
import { Colors, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { useCountUp } from '@/lib/useCountUp';
import type { SummaryPower } from './types';

interface Props {
  power: SummaryPower;
  onRevealed?: () => void;
}

/** Hero of the summary: "Power level 4,210 → 4,268 (+58)" with a count-up. */
export function PowerDeltaReveal({ power, onRevealed }: Props) {
  const world = useWorld();
  const after = power.after ?? 0;
  const from = power.before ?? 0;
  const shown = useCountUp(after, { from, duration: 1400, haptics: true, run: power.after != null, onDone: onRevealed });

  if (power.after == null) {
    return (
      <MangaPanel motif="header">
        <AppText variant="title" color={world.aura}>Calibrating</AppText>
        <AppText variant="body">Log a squat, bench, or deadlift set to get your Power Level.</AppText>
      </MangaPanel>
    );
  }

  const delta = power.before != null ? after - power.before : null;
  const partial = power.confidence === 'partial';

  return (
    <MangaPanel motif="hero">
      <SfxLayer text={world.sfx.summary} size={120} opacity={0.1} color={world.aura} />
      <AppText variant="label">Power level</AppText>
      <View style={styles.row}>
        {power.before != null && (
          <>
            <AppText variant="stat" color={Colors.textSecondary}>{formatPower(power.before)}</AppText>
            <AppText variant="stat" color={Colors.textMuted}>→</AppText>
          </>
        )}
        <AppText variant="power" style={styles.big} allowFontScaling={false}>
          {partial ? '≈' : ''}{formatPower(shown)}
        </AppText>
      </View>
      {delta != null && (
        <AppText variant="stat" color={delta > 0 ? world.aura : Colors.textMuted}>
          {delta > 0 ? `+${formatPower(delta)}` : delta < 0 ? `−${formatPower(-delta)}` : 'No change'}
        </AppText>
      )}
      {partial && <AppText variant="caption">Partial reading</AppText>}
    </MangaPanel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, flexWrap: 'wrap' },
  big: { fontSize: 48, lineHeight: 52 },
});
