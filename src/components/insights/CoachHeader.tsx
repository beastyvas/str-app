import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { CHARACTERS } from '@/constants/cameos';
import { RANK_TIERS, ROMAN, TIER_CHARACTER, TIER_COACH_NAME } from '@/constants/ranks';
import { WORLDS, useWorldStore } from '@/theme';

/** Current lead's portrait + "Gojo, The Tactician", in that world's theme. */
export function CoachHeader({ right }: { right?: ReactNode }) {
  const rankKey = useWorldStore(s => s.rankKey);
  const rankSub = useWorldStore(s => s.rankSub);
  const world = WORLDS[rankKey];
  const lead = CHARACTERS[TIER_CHARACTER[rankKey]];
  const tier = RANK_TIERS.find(t => t.key === rankKey)!;
  const Motif = world.Motif;
  return (
    <View style={styles.wrap}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none"><Motif intensity="header" /></View>
      <View style={[styles.portrait, { borderColor: world.aura }]}>
        <Image source={lead.portrait} style={styles.img} contentFit="contain" contentPosition="bottom" />
      </View>
      <View style={styles.text}>
        <AppText variant="title" color={world.aura} numberOfLines={1}>{lead.name}</AppText>
        <AppText variant="label">{TIER_COACH_NAME[rankKey]} · {tier.label} {ROMAN[rankSub]}</AppText>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, overflow: 'hidden' },
  portrait: { width: 54, height: 72, borderWidth: 2, backgroundColor: Colors.surface, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  text: { flex: 1, gap: 2 },
});
