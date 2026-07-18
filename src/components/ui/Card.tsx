import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { PressableScale } from './PressableScale';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  /** Renders the 3px top accent strip in this color */
  accent?: string;
  padding?: keyof typeof Spacing;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, onPress, accent, padding = 'lg', style }: CardProps) {
  const body = (
    <View style={[styles.card, style]}>
      {accent && <View style={[styles.strip, { backgroundColor: accent }]} />}
      <View style={{ padding: Spacing[padding] }}>{children}</View>
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
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.card,
  },
  strip: { height: 3, width: '100%' },
});
