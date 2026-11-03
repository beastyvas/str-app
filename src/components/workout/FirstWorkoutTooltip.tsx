import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { AppText } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';

interface Props {
  message: string;
  visible: boolean;
}

/** First-workout coaching hint. Never takes touches. */
export function FirstWorkoutTooltip({ message, visible }: Props) {
  const world = useWorld();
  if (!visible) return null;
  return (
    <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOut.duration(160)} style={styles.wrap} pointerEvents="none">
      <View style={[styles.panel, { borderColor: world.aura }]}>
        <AppText variant="heading">{message}</AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.screenH, right: Spacing.screenH, bottom: 88, zIndex: 10 },
  panel: { backgroundColor: Colors.surface, borderWidth: 2, padding: Spacing.lg },
});
