import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { RANK_TIERS, ROMAN, TIER_CHARACTER } from '@/constants/ranks';
import { CHARACTERS } from '@/constants/cameos';
import { getScaledThresholds } from '@/constants/strengthStandards';
import { WORLDS, tierIndex, useWorldStore } from '@/theme';
import { toDisplay, type WeightUnit } from '@/lib/units';
import type { RankResult } from '@/constants/ranks';

interface Props {
  result: RankResult | null;
  bodyweightLbs: number;
  gender: 'male' | 'female' | 'other' | null | undefined;
  unit: WeightUnit;
  /** Sub-tier thresholds per lift for my bodyweight */
  showThresholds?: boolean;
}

const LIFTS = [
  { lift: 'squat' as const, label: 'Squat' },
  { lift: 'bench' as const, label: 'Bench' },
  { lift: 'deadlift' as const, label: 'Deadlift' },
];

/**
 * The six worlds as a vertical ladder, top tier first. Each band shows its
 * motif, aura and lead (silhouetted until unlocked); my position is a
 * glowing tick on my band at my sub-tier.
 */
export function WorldLadder({ result, bodyweightLbs, gender, unit, showThresholds }: Props) {
  const highest = useWorldStore(s => s.highestKey);
  const g = gender === 'female' ? 'female' : 'male';
  const thresholds = Object.fromEntries(LIFTS.map(l => [l.lift, getScaledThresholds(l.lift, bodyweightLbs, g)]));

  return (
    <View style={styles.ladder}>
      {[...RANK_TIERS].reverse().map(tier => {
        const idx = RANK_TIERS.indexOf(tier);
        const world = WORLDS[tier.key];
        const unlocked = idx <= tierIndex(highest);
        const mine = result?.tier.key === tier.key;
        const lead = CHARACTERS[TIER_CHARACTER[tier.key]];
        const Motif = world.Motif;
        return (
          <View key={tier.key} style={[styles.band, { borderLeftColor: unlocked ? world.aura : Colors.border }, mine && { borderColor: world.aura }]}>
            {unlocked && <View style={StyleSheet.absoluteFill} pointerEvents="none"><Motif intensity="header" /></View>}
            <View style={styles.head}>
              <Image
                source={lead.portrait}
                style={styles.portrait}
                contentFit="contain"
                tintColor={unlocked ? undefined : Colors.surface3}
                accessibilityLabel={unlocked ? lead.name : 'Locked'}
              />
              <View style={styles.flex}>
                <AppText variant="title" color={unlocked ? world.aura : Colors.textMuted} style={styles.title}>{tier.label}</AppText>
                <AppText variant="caption">{unlocked ? `${world.series} · ${lead.name}` : 'Locked'}</AppText>
              </View>
            </View>

            {/* Sub-tier track; my position glows */}
            <View style={styles.subs}>
              {[1, 2, 3, 4].map(sub => {
                const here = mine && result?.subTier === sub;
                const passed = result && (idx < RANK_TIERS.findIndex(t => t.key === result.tier.key) || (mine && sub < result.subTier));
                return (
                  <View key={sub} style={styles.sub}>
                    <View style={[
                      styles.tick,
                      (passed || here) && { backgroundColor: world.aura },
                      here && [styles.tickHere, { shadowColor: world.aura }],
                    ]} />
                    <AppText variant="caption" color={here ? Colors.text : Colors.textMuted}>{ROMAN[sub]}</AppText>
                  </View>
                );
              })}
            </View>

            {showThresholds && (
              <View style={styles.table}>
                {LIFTS.map(l => (
                  <View key={l.lift} style={styles.tableRow}>
                    <AppText variant="caption" style={styles.liftCol}>{l.label}</AppText>
                    {[0, 1, 2, 3].map(s => (
                      <AppText key={s} variant="caption" color={Colors.textSecondary} mono style={styles.numCol}>
                        {Math.round(toDisplay(thresholds[l.lift][idx * 4 + s], unit))}
                      </AppText>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
      {showThresholds && <AppText variant="caption">Thresholds in {unit} for your bodyweight. Rank follows your weakest lift.</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  ladder: { gap: Spacing.sm },
  band: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4, padding: Spacing.md, gap: Spacing.sm, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  portrait: { width: 42, height: 56 },
  flex: { flex: 1, gap: 2 },
  title: { fontSize: 18, lineHeight: 24 },
  subs: { flexDirection: 'row', gap: Spacing.sm },
  sub: { flex: 1, alignItems: 'center', gap: 2 },
  tick: { height: 4, alignSelf: 'stretch', backgroundColor: Colors.surface3 },
  tickHere: { height: 6, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  table: { gap: 2 },
  tableRow: { flexDirection: 'row', alignItems: 'center' },
  liftCol: { width: 64 },
  numCol: { flex: 1, textAlign: 'center' },
});
