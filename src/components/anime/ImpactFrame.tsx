import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/theme';
import { SpeedLines } from './SpeedLines';
import { SfxLayer } from './SfxLayer';
import { useImpactStore } from './useImpactStore';

// Ink shards around the edges — abstract silhouettes, not figures.
const SHARDS = [
  '0,0 140,0 40,120', '400,0 260,0 380,150', '0,400 0,250 120,400',
  '400,400 270,400 400,230', '0,180 70,200 0,230', '400,170 330,200 400,240',
];

/**
 * Root-level overlay (mounted once in app/_layout.tsx). `fireImpact(color)`
 * plays the anime "hit": a 120ms inverted flash — paper ground, ink shards,
 * aura speed lines — with a heavy haptic. Under Reduce Motion it becomes a
 * simple aura border pulse: no flash, no shake.
 */
export function ImpactFrame() {
  const { seq, color, sfx } = useImpactStore();
  const reduce = useReducedMotion();
  const flash = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (seq === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    if (reduce) {
      pulse.value = withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 420 }));
    } else {
      flash.value = withSequence(withTiming(1, { duration: 16 }), withTiming(1, { duration: 120 }), withTiming(0, { duration: 140 }));
    }
  }, [seq]);

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const aura = color ?? Colors.accent;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.paper, flashStyle]}>
        <SpeedLines color={aura} count={64} opacity={0.9} hole={0.28} />
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 400" preserveAspectRatio="none">
          {SHARDS.map((p, i) => <Polygon key={i} points={p} fill={Colors.ink} />)}
        </Svg>
        {sfx && <SfxLayer text={sfx} size={140} opacity={1} color={Colors.ink} rotate={-8} />}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.pulse, { borderColor: aura }, pulseStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: Colors.paper },
  pulse: { borderWidth: 6 },
});
