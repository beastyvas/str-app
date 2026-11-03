import { StyleSheet, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { AppText } from './AppText';
import { IconSymbol, IconName } from './IconSymbol';
import { PressableScale } from './PressableScale';

interface StatTileProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: IconName;
  tint?: string;
  onPress?: () => void;
}

/** One stat in a compact row: Chakra Petch value over a sentence-case label. No box. */
export function StatTile({ label, value, sub, icon, tint, onPress }: StatTileProps) {
  const body = (
    <View style={styles.tile}>
      <AppText variant="stat" color={tint ?? Colors.text}>{String(value)}</AppText>
      <View style={styles.labelRow}>
        {icon && <IconSymbol name={icon} size={12} color={tint ?? Colors.textMuted} />}
        <AppText variant="caption">{label}</AppText>
      </View>
      {sub != null && <AppText variant="caption">{sub}</AppText>}
    </View>
  );
  if (!onPress) return body;
  return <PressableScale onPress={onPress} style={styles.flex}>{body}</PressableScale>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tile: { flex: 1, alignItems: 'flex-start', gap: 2, paddingVertical: Spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
