import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText, IconSymbol, Section } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { RANK_TIERS, TIER_CHARACTER } from '@/constants/ranks';
import { CHARACTERS } from '@/constants/cameos';
import { WORLD_LIST, tierIndex, useWorldStore } from '@/theme';

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** Theme world: "Match my rank" (default) or any unlocked world. Locked worlds are silhouettes. */
export function AppearanceSection() {
  const override = useWorldStore(s => s.override);
  const highest = useWorldStore(s => s.highestKey);
  const rankKey = useWorldStore(s => s.rankKey);
  const setOverride = useWorldStore(s => s.setOverride);

  return (
    <Section title="Appearance">
      <View style={styles.group}>
        <TouchableOpacity onPress={() => setOverride(null)} style={styles.row} accessibilityState={{ selected: !override }}>
          <View style={styles.flex}>
            <AppText variant="heading">Match my rank</AppText>
            <AppText variant="caption">The app changes worlds as you rank up</AppText>
          </View>
          {!override && <IconSymbol name="check" size={18} color={Colors.text} />}
        </TouchableOpacity>
        {WORLD_LIST.map(w => {
          const unlocked = tierIndex(w.key) <= tierIndex(highest);
          const selected = override === w.key;
          const tier = RANK_TIERS.find(t => t.key === w.key)!;
          return (
            <TouchableOpacity
              key={w.key}
              disabled={!unlocked}
              onPress={() => setOverride(w.key)}
              style={[styles.row, styles.divider]}
              accessibilityState={{ selected, disabled: !unlocked }}
            >
              <Image
                source={CHARACTERS[TIER_CHARACTER[w.key]].portrait}
                style={styles.portrait}
                contentFit="contain"
                tintColor={unlocked ? undefined : Colors.surface3}
              />
              <View style={styles.flex}>
                <AppText variant="heading" color={unlocked ? w.aura : Colors.textMuted}>{titleCase(tier.label)}</AppText>
                <AppText variant="caption">
                  {unlocked ? `${w.series}${w.key === rankKey ? ' · your rank' : ''}` : `Reach ${titleCase(tier.label)} to unlock`}
                </AppText>
              </View>
              {selected && <IconSymbol name="check" size={18} color={w.aura} />}
              {!unlocked && <IconSymbol name="lock" size={14} color={Colors.textMuted} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 56, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  portrait: { width: 30, height: 40 },
  flex: { flex: 1, gap: 2 },
});
