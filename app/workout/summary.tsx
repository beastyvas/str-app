import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { AppText, Button, Section, StatTile } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { fmtVolume, toDisplay, unitFromProfile } from '@/lib/units';
import { TierAdvancementScreen } from '@/components/TierAdvancementScreen';
import { PowerDeltaReveal } from '@/components/summary/PowerDeltaReveal';
import { useRankAdvance } from '@/components/summary/useRankAdvance';
import { fireFinishCameo } from '@/components/summary/finishCameo';
import type { SummaryPower } from '@/components/summary/types';
import { Cameo } from '@/components/cameo';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function parse(data?: string) {
  try { return data ? JSON.parse(data) : null; } catch { return null; }
}

/**
 * Workout summary. Hero: the Power Level delta reveal. Then one compact row
 * of stats, the PRs, and the exercise list. Reveal → rank-up screen (if any)
 * → exactly one cameo.
 */
export default function WorkoutSummaryScreen() {
  const { data } = useLocalSearchParams<{ data: string }>();
  const router = useRouter();
  const world = useWorld();
  const { profile, user } = useAuth();
  const unit = unitFromProfile(profile?.unit_pref);
  const summary = parse(data);
  const power: SummaryPower | null = summary?.power ?? null;

  const advance = useRankAdvance(power);
  const [showAdvance, setShowAdvance] = useState(false);
  const [advanceDone, setAdvanceDone] = useState(false);
  const cameoFired = useRef(false);

  const fireCameo = () => {
    if (cameoFired.current || !summary) return;
    cameoFired.current = true;
    fireFinishCameo({
      userId: user?.id,
      name: profile?.display_name?.split(' ')[0] ?? 'lifter',
      power, advance, facts: summary.cameo ?? null,
    });
  };
  const onRevealed = () => {
    if (advance && !advanceDone) setShowAdvance(true);
    else fireCameo();
  };

  useEffect(() => {
    if (!summary) { router.replace('/(tabs)'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // No Power Level to reveal — go straight to the cameo.
    if (!power || power.after == null) {
      const t = setTimeout(fireCameo, 900);
      return () => clearTimeout(t);
    }
  }, []);

  if (!summary) return null;
  const { name, duration, totalSets, totalVolume, prs = [], exercises = [] } = summary;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <AppText variant="label">Workout complete</AppText>
          <AppText variant="display" numberOfLines={2}>{name}</AppText>
        </View>

        {power && <PowerDeltaReveal power={power} onRevealed={onRevealed} />}

        <Animated.View entering={FadeInDown.delay(200)} style={styles.stats}>
          <StatTile label="Duration" value={formatDuration(duration)} />
          <StatTile label="Volume" value={fmtVolume(totalVolume, unit)} />
          <StatTile label="Sets" value={totalSets} />
          <StatTile label="PRs" value={prs.length} tint={prs.length ? world.aura : undefined} />
        </Animated.View>

        {prs.length > 0 && (
          <Section title="Personal records">
            <View style={styles.list}>
              {prs.map((pr: any, i: number) => (
                <View key={i} style={[styles.row, i > 0 && styles.divider]}>
                  <View style={[styles.prChip, { backgroundColor: world.aura }]}>
                    <AppText variant="label" color={Colors.bg}>PR</AppText>
                  </View>
                  <AppText variant="heading" numberOfLines={1} style={styles.flex}>{pr.exerciseName}</AppText>
                  <AppText variant="stat" color={world.aura}>{toDisplay(pr.weight, unit)} × {pr.reps}</AppText>
                </View>
              ))}
            </View>
          </Section>
        )}

        <Section title="Exercises">
          <View style={styles.list}>
            {exercises.map((ex: any, i: number) => (
              <View key={i} style={[styles.row, i > 0 && styles.divider]}>
                <View style={styles.flex}>
                  <AppText variant="heading" numberOfLines={1}>{ex.name}</AppText>
                  {ex.sets[0] && (
                    <AppText variant="caption">
                      Top set {ex.sets[0].weight === 0 ? 'BW' : toDisplay(ex.sets[0].weight, unit)} × {ex.sets[0].reps}
                    </AppText>
                  )}
                </View>
                <AppText variant="label">{ex.sets.length} sets</AppText>
              </View>
            ))}
          </View>
        </Section>

        <Button label="Done" size="lg" fullWidth onPress={() => router.replace('/(tabs)')} />
      </ScrollView>

      <TierAdvancementScreen
        visible={showAdvance}
        tier={advance?.tier ?? null}
        subTier={advance?.subTier}
        isSubTierAdvance={advance?.isSubTierAdvance}
        liftName={advance?.liftName}
        liftTierName={advance?.liftTierName}
        liftTierColor={advance?.liftTierColor}
        onDismiss={() => { setShowAdvance(false); setAdvanceDone(true); fireCameo(); }}
      />
      <Cameo host="local" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.screenH, paddingBottom: 60, gap: Spacing.group },
  head: { gap: Spacing.xs },
  stats: { flexDirection: 'row', gap: Spacing.md },
  list: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 56, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  prChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  flex: { flex: 1, gap: 2 },
});
