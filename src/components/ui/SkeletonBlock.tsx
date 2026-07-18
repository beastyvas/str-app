import { useEffect } from 'react';
import { DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface SkeletonBlockProps {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Pulsing placeholder block for loading states. */
export function SkeletonBlock({ width = '100%', height, radius = Radius.md, style }: SkeletonBlockProps) {
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: Colors.surface2 },
        animStyle,
        style,
      ]}
    />
  );
}

/** Row of a circle avatar + two text lines — the standard list-item skeleton. */
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <SkeletonBlock width={44} height={44} radius={22} />
      <View style={styles.lines}>
        <SkeletonBlock width="60%" height={14} />
        <SkeletonBlock width="35%" height={10} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  lines: { flex: 1, gap: Spacing.sm },
});
