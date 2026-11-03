import { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { AppText } from './AppText';

interface SectionProps {
  /** Optional sentence-case title, rendered in `heading` */
  title?: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
}

/** Optional heading row + content — the standard group rhythm (28 between groups). */
export function Section({ title, action, children }: SectionProps) {
  const world = useWorld();
  return (
    <View style={styles.wrap}>
      {(title != null || action) && (
        <View style={styles.header}>
          {title != null ? <AppText variant="heading">{title}</AppText> : <View />}
          {action && (
            <TouchableOpacity onPress={action.onPress} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <AppText variant="label" color={world.aura}>{action.label}</AppText>
            </TouchableOpacity>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
