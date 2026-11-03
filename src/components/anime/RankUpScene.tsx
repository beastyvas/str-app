import { ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Polygon } from 'react-native-svg';
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import type { WorldTheme } from '@/theme';
import { SpeedLines } from './SpeedLines';
import { SfxLayer } from './SfxLayer';

const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);

interface RankUpSceneProps {
  world: WorldTheme;
  /** Change to replay */
  playKey?: number | string;
}

/**
 * The world's signature rank-up moment, as a full-bleed background layer.
 * TierAdvancementScreen owns the text and logic; this only plays the scene.
 * Reduce Motion cuts straight to each scene's end state with no flash.
 */
export function RankUpScene({ world, playKey }: RankUpSceneProps) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);      // main progress 0→1
  const flash = useSharedValue(0);               // impact flash (onePunch / auraFlare)

  useEffect(() => {
    if (reduce) { p.value = 1; flash.value = 0; return; }
    p.value = 0;
    p.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    if (world.rankUpScene === 'onePunch' || world.rankUpScene === 'auraFlare') {
      flash.value = withSequence(withTiming(1, { duration: 16 }), withTiming(1, { duration: 120 }), withTiming(0, { duration: 200 }));
    }
  }, [playKey, world.key, reduce]);

  const fade = useAnimatedStyle(() => ({ opacity: p.value }));
  const pop = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 2),
    transform: [{ scale: p.value < 0.6 ? p.value / 0.5 : 1.2 - (p.value - 0.6) * 0.5 }],
  }));
  const rise = useAnimatedStyle(() => ({ transform: [{ scaleY: p.value }, { translateY: (1 - p.value) * 120 }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const strokeProps = useAnimatedProps(() => ({ strokeDashoffset: 1400 * (1 - p.value) }));
  const ring1 = useAnimatedProps(() => ({ r: 20 + p.value * 300, opacity: 1 - p.value * 0.4 }));
  const ring2 = useAnimatedProps(() => ({ r: Math.max(0, p.value - 0.2) * 360, opacity: 0.8 - p.value * 0.4 }));
  const ring3 = useAnimatedProps(() => ({ r: Math.max(0, p.value - 0.4) * 420, opacity: 0.6 - p.value * 0.3 }));

  const a = world.aura;
  let scene: ReactNode = null;

  switch (world.rankUpScene) {
    case 'inkStroke':
      scene = (
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
          <APath
            d="M -20 520 C 80 430, 160 470, 220 400 S 360 300, 430 260"
            stroke={a} strokeWidth={46} strokeLinecap="round" fill="none"
            strokeDasharray={1400} animatedProps={strokeProps}
          />
          <APath
            d="M -20 560 C 100 500, 200 520, 260 450 S 380 360, 430 330"
            stroke={Colors.ink} strokeWidth={14} strokeLinecap="round" fill="none"
            strokeDasharray={1400} animatedProps={strokeProps}
          />
        </Svg>
      );
      break;
    case 'comicBurst': {
      const pts = Array.from({ length: 24 }, (_, i) => {
        const r = i % 2 === 0 ? 190 : 120;
        const t = (i / 24) * Math.PI * 2;
        return `${200 + Math.cos(t) * r},${400 + Math.sin(t) * r}`;
      }).join(' ');
      scene = (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, fade]}><SpeedLines color={Colors.ink} count={60} opacity={0.8} /></Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, pop]}>
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
              <Polygon points={pts} fill={a} stroke={Colors.ink} strokeWidth={8} />
            </Svg>
          </Animated.View>
        </>
      );
      break;
    }
    case 'domainExpand':
      scene = (
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
          <G fill="none" stroke={a}>
            <ACircle cx={200} cy={400} animatedProps={ring1} strokeWidth={3} />
            <ACircle cx={200} cy={400} animatedProps={ring2} strokeWidth={1.5} />
            <ACircle cx={200} cy={400} animatedProps={ring3} strokeWidth={6} stroke={world.auraAlt} />
          </G>
        </Svg>
      );
      break;
    case 'auraFlare': {
      const flames = Array.from({ length: 9 }, (_, i) => {
        const x = i * 50;
        const h = 300 + (i % 3) * 120;
        return `M ${x - 40} 800 C ${x - 40} ${800 - h * 0.5}, ${x - 5} ${800 - h * 0.6}, ${x} ${800 - h} C ${x + 8} ${800 - h * 0.6}, ${x + 40} ${800 - h * 0.45}, ${x + 40} 800 Z`;
      });
      scene = (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, rise]}>
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 800" preserveAspectRatio="xMidYMax slice">
              {flames.map((d, i) => <Path key={i} d={d} fill={i % 2 ? world.auraAlt : a} opacity={0.55} />)}
            </Svg>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.paper, flashStyle]} />
        </>
      );
      break;
    }
    case 'systemLevelUp':
      scene = (
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, pop]}>
          <View style={[styles.window, { borderColor: a, shadowColor: a }]}>
            <AppText variant="label" color={a} style={styles.windowText}>[ LEVEL UP ]</AppText>
          </View>
        </Animated.View>
      );
      break;
    case 'onePunch':
      scene = (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, styles.paper, flashStyle]}>
            <SpeedLines color={Colors.ink} count={72} opacity={1} hole={0.2} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, fade]}>
            <View style={styles.calmRule} />
          </Animated.View>
        </>
      );
      break;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {scene}
      <Animated.View style={[StyleSheet.absoluteFill, fade]}>
        <SfxLayer text={world.sfx.rankUp} size={130} opacity={0.12} color={a} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: Colors.paper },
  center: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 120 },
  window: {
    borderWidth: 1.5,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bg + 'CC',
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  windowText: { fontFamily: Fonts.hudBold, fontSize: 18, letterSpacing: 3 },
  calmRule: { position: 'absolute', left: 40, right: 40, top: '50%', height: 1, backgroundColor: Colors.paper, opacity: 0.4 },
});
