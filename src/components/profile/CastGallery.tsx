import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText, PressableScale, Section } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { CHARACTERS } from '@/constants/cameos';
import { GUEST_CAST, TIER_KEYS, WORLD_CAST, type CharacterId } from '@/constants/cast';
import { RANK_TIERS } from '@/constants/ranks';
import { WORLDS, tierIndex, useWorldStore } from '@/theme';
import { useCameoStore } from '@/components/cameo';

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/**
 * The roster: every world's cast, grouped. Unlocked characters show portrait,
 * name and appearance count, and tap to replay a random line. Locked worlds
 * render silhouettes (tinted surface3) with "Reach {tier} to unlock".
 */
export function CastGallery({ name }: { name: string }) {
  const highest = useWorldStore(s => s.highestKey);
  const counts = useCameoStore(s => s.counts);
  const replay = useCameoStore(s => s.replay);

  const cell = (id: CharacterId, unlocked: boolean, color: string) => {
    const c = CHARACTERS[id];
    return (
      <PressableScale
        key={id}
        disabled={!unlocked}
        onPress={() => replay(id, { name })}
        style={styles.cell}
        accessibilityLabel={unlocked ? `${c.name}, tap to hear a line` : 'Locked character'}
      >
        <View style={[styles.frame, { borderColor: unlocked ? color + '66' : Colors.border }]}>
          <Image
            source={c.portrait}
            style={styles.img}
            contentFit="contain"
            tintColor={unlocked ? undefined : Colors.surface3}
          />
        </View>
        <AppText variant="caption" color={unlocked ? Colors.text : Colors.textMuted} numberOfLines={1}>
          {unlocked ? c.name : '???'}
        </AppText>
        {unlocked && <AppText variant="caption">{counts[id] ?? 0}×</AppText>}
      </PressableScale>
    );
  };

  return (
    <Section title="Cast">
      {TIER_KEYS.map(tier => {
        const unlocked = tierIndex(tier) <= tierIndex(highest);
        const world = WORLDS[tier];
        const rank = RANK_TIERS.find(t => t.key === tier)!;
        return (
          <View key={tier} style={styles.group}>
            <View style={styles.groupHead}>
              <AppText variant="heading" color={unlocked ? world.aura : Colors.textMuted}>{titleCase(rank.label)}</AppText>
              <AppText variant="caption">{unlocked ? world.series : `Reach ${titleCase(rank.label)} to unlock`}</AppText>
            </View>
            <View style={styles.grid}>{WORLD_CAST[tier].map(id => cell(id, unlocked, world.aura))}</View>
          </View>
        );
      })}
      <View style={styles.group}>
        <View style={styles.groupHead}>
          <AppText variant="heading">Guests</AppText>
          <AppText variant="caption">Show up when they feel like it</AppText>
        </View>
        <View style={styles.grid}>
          {GUEST_CAST.map(id => cell(id, (counts[id] ?? 0) > 0, CHARACTERS[id].bubbleColor))}
        </View>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.sm },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cell: { width: '31%', alignItems: 'center', gap: 2, minHeight: 44 },
  frame: { width: '100%', aspectRatio: 3 / 4, backgroundColor: Colors.surface, borderWidth: 1 },
  img: { width: '100%', height: '100%' },
});
