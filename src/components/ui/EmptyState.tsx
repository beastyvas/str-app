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
      <View style={styles.iconBubble}>
        <IconSymbol name={icon} size={26} color={Colors.textMuted} />
      </View>
      <AppText variant="heading" style={styles.center}>{title}</AppText>
      {body != null && <AppText variant="body" style={styles.center}>{body}</AppText>}
      {cta && <Button label={cta.label} onPress={cta.onPress} variant="tinted" size="sm" />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  iconBubble: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  center: { textAlign: 'center' },
});
