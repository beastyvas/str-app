import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { PressableScale } from './PressableScale';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  /** Renders a 3px left rule in this color (e.g. the current set) */
  accent?: string;
  /** 'none' = full-bleed content (rows with edge-to-edge dividers) */
  padding?: keyof typeof Spacing | 'none';
  style?: StyleProp<ViewStyle>;
}

/**
 * A plain grouped surface — the default container for lists and groups.
 * Never nest Cards; heroes use `MangaPanel` instead. No shadows.
 */
export function Card({ children, onPress, accent, padding = 'lg', style }: CardProps) {
  const body = (
    <View style={[styles.card, style]}>
      {accent && <View style={[styles.rule, { backgroundColor: accent }]} />}
      <View style={{ padding: padding === 'none' ? 0 : Spacing[padding] }}>{children}</View>
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale onPress={onPress} scaleTo={0.98}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  rule: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
});
