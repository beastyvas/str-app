import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { Colors, Gradients, Radius, Spacing } from '@/constants/theme';
import { AppText, PressableScale } from '@/components/ui';

interface StartWorkoutCTAProps {
  onPress: () => void;
}

/** The hero brass CTA with a slow pulse glow — the screen's one loud element. */
export function StartWorkoutCTA({ onPress }: StartWorkoutCTAProps) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, []);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0, 0.18]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1.04, 1]) }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.glow, glowStyle]} />
      <PressableScale onPress={onPress} haptic="medium" scaleTo={0.98}>
        <LinearGradient
          colors={Gradients.brass}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.cta}
        >
          <AppText variant="overline" color="#141210" style={styles.kicker}>
            Ready to train?
          </AppText>
          <AppText variant="title" color="#141210" style={styles.label}>
            Start Workout →
          </AppText>
        </LinearGradient>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md + 2, position: 'relative' },
  glow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: Radius.xl,
    backgroundColor: Colors.accent,
  },
  cta: {
    borderRadius: Radius.xl,
    padding: 22,
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  kicker: { opacity: 0.75, marginBottom: 6, color: '#141210' },
  label: { fontSize: 24 },
});
