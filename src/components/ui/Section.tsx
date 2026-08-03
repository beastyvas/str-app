import { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { AppText } from './AppText';

interface SectionProps {
  title: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
}

/** Overline header row + content — the standard section rhythm. */
export function Section({ title, action, children }: SectionProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <AppText variant="overline">{title}</AppText>
        {action && (
          <TouchableOpacity onPress={action.onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppText variant="caption" color={Colors.accent} style={styles.action}>
              {action.label}
            </AppText>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: { fontWeight: '700' },
});
