import { StyleSheet, Switch, View } from 'react-native';
import { AppText, Section } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { useCameoStore } from '@/components/cameo';

/** "Character cameos" and "Random drop-ins" switches (AsyncStorage-backed). */
export function CameoSettings() {
  const world = useWorld();
  const enabled = useCameoStore(s => s.enabled);
  const dropins = useCameoStore(s => s.dropins);
  const setEnabled = useCameoStore(s => s.setEnabled);
  const setDropins = useCameoStore(s => s.setDropins);
  const track = { false: Colors.surface3, true: world.aura };
  return (
    <Section title="Cameos">
      <View style={styles.list}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppText variant="heading">Character cameos</AppText>
            <AppText variant="caption">PRs, finishes, rank-ups</AppText>
          </View>
          <Switch value={enabled} onValueChange={setEnabled} trackColor={track} />
        </View>
        <View style={[styles.row, styles.divider]}>
          <View style={styles.flex}>
            <AppText variant="heading" color={enabled ? Colors.text : Colors.textMuted}>Random drop-ins</AppText>
            <AppText variant="caption">During rests and on Home</AppText>
          </View>
          <Switch value={enabled && dropins} disabled={!enabled} onValueChange={setDropins} trackColor={track} />
        </View>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, minHeight: 60 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.border },
  flex: { flex: 1, gap: 2, paddingVertical: Spacing.sm },
});
