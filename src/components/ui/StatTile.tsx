import { StyleSheet, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
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

export function StatTile({ label, value, sub, icon, tint, onPress }: StatTileProps) {
  const body = (
    <View style={[styles.tile, tint != null && { borderColor: tint + '30' }]}>
      <View style={styles.labelRow}>
        {icon && <IconSymbol name={icon} size={11} color={tint ?? Colors.textMuted} />}
        <AppText variant="overline" style={styles.label}>{label}</AppText>
      </View>
      <AppText variant="statValue" color={tint ?? Colors.text}>
        {String(value)}
      </AppText>
      {sub != null && <AppText variant="micro">{sub}</AppText>}
    </View>
  );
  if (!onPress) return body;
  return <PressableScale onPress={onPress} style={styles.flex}>{body}</PressableScale>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg - 2,
    alignItems: 'center',
    gap: 4,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 9, letterSpacing: 1.5 },
});
