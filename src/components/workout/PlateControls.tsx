import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { describeWeight, PLATE_CONFIGS, type PlateSystem } from '@/lib/plateUtils';

interface Props {
  plateWeight: number;
  plateSystem: PlateSystem;
  onAdjust: (plate: number, dir: 1 | -1) => void;
  onSwitchSystem: () => void;
}

/** Plates mode: add/remove pairs, with the per-side breakdown. */
export function PlateControls({ plateWeight, plateSystem, onAdjust, onSwitchSystem }: Props) {
  const cfg = PLATE_CONFIGS[plateSystem];
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <AppText variant="caption" style={styles.flex}>{describeWeight(plateWeight, cfg)}</AppText>
        <TouchableOpacity onPress={onSwitchSystem} style={styles.switch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <AppText variant="caption" color={Colors.textSecondary}>
            {plateSystem === 'lbs' ? 'Use kg plates' : 'Use lb plates'}
          </AppText>
        </TouchableOpacity>
      </View>
      <View style={styles.plates}>
        {cfg.plateOptions.map(p => {
          const canRemove = plateWeight - p * 2 >= cfg.barWeight;
          return (
            <View key={p} style={styles.col}>
              <TouchableOpacity onPress={() => onAdjust(p, 1)} style={styles.btn} accessibilityLabel={`Add ${p} plates`}>
                <AppText variant="stat" style={styles.btnText}>+{p}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onAdjust(p, -1)}
                disabled={!canRemove}
                style={[styles.btn, !canRemove && styles.off]}
                accessibilityLabel={`Remove ${p} plates`}
              >
                <AppText variant="stat" color={Colors.textMuted} style={styles.btnText}>−{p}</AppText>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: Spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  switch: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  plates: { flexDirection: 'row', gap: 6 },
  col: { flex: 1, gap: 4 },
  btn: {
    minHeight: 40, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
  },
  btnText: { fontSize: 14, lineHeight: 18 },
  off: { opacity: 0.3 },
});
