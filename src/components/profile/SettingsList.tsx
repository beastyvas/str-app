import { ReactNode } from 'react';
import { StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { AppText, IconSymbol, Section } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';

/** iOS-style grouped list: label left, value right, chevron. */
export function SettingsGroup({ title, children, footer }: { title?: string; children: ReactNode; footer?: string }) {
  return (
    <Section title={title}>
      <View style={styles.group}>{children}</View>
      {footer ? <AppText variant="caption">{footer}</AppText> : null}
    </Section>
  );
}

interface RowProps {
  label: string;
  value?: string;
  sub?: string;
  onPress?: () => void;
  destructive?: boolean;
  first?: boolean;
  /** Renders a Switch tinted with the aura instead of a chevron */
  toggle?: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean };
}

export function SettingsRow({ label, value, sub, onPress, destructive, first, toggle }: RowProps) {
  const world = useWorld();
  const body = (
    <View style={[styles.row, !first && styles.divider]}>
      <View style={styles.flex}>
        <AppText variant="heading" color={destructive ? Colors.danger : Colors.text} style={styles.label}>{label}</AppText>
        {sub ? <AppText variant="caption">{sub}</AppText> : null}
      </View>
      {value ? <AppText variant="body" numberOfLines={1} style={styles.value}>{value}</AppText> : null}
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          disabled={toggle.disabled}
          trackColor={{ false: Colors.surface3, true: world.aura }}
        />
      ) : onPress && !destructive ? (
        <IconSymbol name="chevronRight" size={16} color={Colors.textMuted} />
      ) : null}
    </View>
  );
  if (!onPress || toggle) return body;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button">{body}</TouchableOpacity>;
}

const styles = StyleSheet.create({
  group: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 52, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  flex: { flex: 1, gap: 2 },
  label: { fontSize: 16 },
  value: { maxWidth: '50%' },
});
