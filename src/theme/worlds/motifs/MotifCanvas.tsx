import { ReactNode, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Svg from 'react-native-svg';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { MOTIF_OPACITY, MotifIntensity } from '../types';

interface MotifCanvasProps {
  intensity: MotifIntensity;
  animated?: boolean;
  children: ReactNode;
  /** viewBox width/height — patterns are drawn in this space and sliced to fit */
  vw?: number;
  vh?: number;
}

/**
 * Shared shell for every world motif: an absolute-fill SVG that never takes
 * touches, at the intensity's opacity. `animated` adds a slow (20s) drift —
 * reserved for the Home hero, and off under Reduce Motion.
 */
export function MotifCanvas({ intensity, animated, children, vw = 400, vh = 400 }: MotifCanvasProps) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (animated && !reduce) {
      t.value = withRepeat(withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.sin) }), -1, true);
    }
  }, [animated, reduce]);
  const drift = useAnimatedStyle(() => ({
    transform: [{ translateX: -12 + t.value * 24 }, { translateY: -6 + t.value * 12 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.fill, { opacity: MOTIF_OPACITY[intensity] }, animated && drift]}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMidYMid slice">
        {children}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Slight overscan so the drift never reveals an edge
  fill: { position: 'absolute', top: -16, left: -16, right: -16, bottom: -16 },
});
