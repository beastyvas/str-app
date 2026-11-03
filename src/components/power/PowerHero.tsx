import { StyleSheet, View } from 'react-native';
import { AppText, Button, PressableScale } from '@/components/ui';
import { MangaPanel, PowerReadout } from '@/components/anime';
import { Colors, Spacing } from '@/constants/theme';
import { ROMAN } from '@/constants/ranks';
import { useWorld } from '@/theme';
import type { PowerReading } from '@/lib/powerLevel';
import { LiftStrip } from './LiftStrip';

interface PowerHeroProps {
  reading: PowerReading | null;
  onOpenLadder: () => void;
  onStartWorkout: () => void;
}

/**
 * The hero of the app: Power Level framed by the world's readout, rank +
 * sub-tier, the one-line next-rank hint, and the squat/bench/deadlift strip.
 * Never renders nothing — no data shows the Calibrating state.
 */
export function PowerHero({ reading, onOpenLadder, onStartWorkout }: PowerHeroProps) {
  const world = useWorld();

  if (!reading || reading.confidence === 'calibrating') {
    return (
      <MangaPanel motif="hero" animatedMotif>
        <View style={styles.center}>
          <PowerReadout power={null} />
          <AppText variant="body" style={styles.centerText}>
            Log one squat, bench, or deadlift set to get your reading.
          </AppText>
          <Button label="Start workout" onPress={onStartWorkout} haptic="medium" />
        </View>
      </MangaPanel>
    );
  }

  const { rank } = reading;
  const partial = reading.confidence === 'partial';

  return (
    <PressableScale onPress={onOpenLadder} scaleTo={0.985} accessibilityRole="button" accessibilityLabel="Open rank ladder">
      <MangaPanel motif="hero" animatedMotif>
        <View style={styles.center}>
          <PowerReadout power={reading.power} partial={partial} menace={reading.nearRankUp} />
          <AppText variant="title" color={rank.tier.color} style={styles.rank}>
            {rank.tier.label} {ROMAN[rank.subTier]}
          </AppText>
          {partial && <AppText variant="caption">Partial reading</AppText>}
          {reading.nextRankHint && (
            <AppText variant="label" style={styles.centerText}>{reading.nextRankHint}</AppText>
          )}
          <LiftStrip reading={reading} color={world.aura} />
        </View>
      </MangaPanel>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: Spacing.md },
  centerText: { textAlign: 'center', color: Colors.textSecondary },
  rank: { marginTop: -Spacing.xs },
});
