import { StyleSheet, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { IconSymbol, IconName } from './IconSymbol';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  body?: string;
  cta?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, body, cta }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <IconSymbol name={icon} size={28} color={Colors.textMuted} />
      <AppText variant="heading" style={styles.center}>{title}</AppText>
      {body != null && <AppText variant="body" style={styles.center}>{body}</AppText>}
      {cta && <Button label={cta.label} onPress={cta.onPress} variant="tinted" size="sm" />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  center: { textAlign: 'center' },
});
