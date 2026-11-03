import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming,
} from 'react-native-reanimated';
import { AppText, Button } from '@/components/ui';
import { PowerReadout, SfxLayer, fireImpact } from '@/components/anime';
import { showCameo } from '@/components/cameo';
import { Colors, Spacing } from '@/constants/theme';
import { ROMAN } from '@/constants/ranks';
import { WORLDS, WorldScope } from '@/theme';
import type { PowerReading } from '@/lib/powerLevel';

const ACircle = Animated.createAnimatedComponent(Circle);
const RING = 280;
const R = 132;
const CIRC = 2 * Math.PI * R;

interface Props {
  /** null = "I don't know yet" → calibrating */
  reading: PowerReading | null;
  name: string;
  onStart: () => void;
}

/**
 * 4 · The reveal: Ink Night in the starting world. A thin aura ring draws
 * in, the number counts 0 → Power Level over ~1.6s with escalating haptic
 * ticks, then the rank name slams in and the aura washes the screen. Then
 * the world's lead introduces themselves as your coach.
 */
export function RevealStep({ reading, name, onStart }: Props) {
  const calibrating = !reading || reading.confidence === 'calibrating';
  const tierKey = calibrating ? 'mortal' : reading!.rank.tier.key;
  const base = WORLDS[tierKey];
  // Calibrating uses the scouter ring in the starting world's aura.
  const world = calibrating ? { ...base, powerReadout: 'scouter' as const } : base;
  const reduce = useReducedMotion();

  const ring = useSharedValue(reduce ? 1 : 0);
  const slam = useSharedValue(reduce ? 1 : 0);
  const wash = useSharedValue(0);
  const [counting, setCounting] = useState(reduce);
  const [slammed, setSlammed] = useState(false);

  useEffect(() => {
    if (reduce) { setCounting(true); return; }
    ring.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    const t = setTimeout(() => setCounting(true), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!calibrating) return;
    const t = setTimeout(() => { setSlammed(true); showCameo('onboarding_reveal', { name }); }, reduce ? 300 : 1400);
    return () => clearTimeout(t);
  }, []);

  const onCountDone = () => {
    setSlammed(true);
    if (!reduce) {
      slam.value = withSpring(1, { damping: 9, stiffness: 220 });
      fireImpact(world.aura, world.sfx.pr);
    }
    wash.value = withDelay(80, withTiming(1, { duration: 700 }));
    setTimeout(() => showCameo('onboarding_reveal', { name }), reduce ? 400 : 1200);
  };

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - ring.value) }));
  const slamStyle = useAnimatedStyle(() => ({
    opacity: slam.value,
    transform: [{ scale: 1.8 - slam.value * 0.8 }],
  }));
  const washStyle = useAnimatedStyle(() => ({ opacity: wash.value * 0.16 }));

  return (
    <WorldScope world={world}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: world.aura }, washStyle]} pointerEvents="none" />
        <View style={StyleSheet.absoluteFill} pointerEvents="none"><world.Motif intensity="full" /></View>

        <View style={styles.center}>
          <View style={styles.ringBox}>
            <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
              <ACircle
                cx={RING / 2} cy={RING / 2} r={R}
                stroke={world.aura} strokeWidth={1.5} fill="none"
                strokeDasharray={CIRC} animatedProps={ringProps}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            </Svg>
            {calibrating ? (
              <PowerReadout power={null} world={world} size={230} />
            ) : (
              counting && (
                <PowerReadout
                  power={reading!.power}
                  partial={reading!.confidence === 'partial'}
                  countFrom={0}
                  countDuration={1600}
                  countHaptics
                  onCountDone={onCountDone}
                  world={world}
                  size={230}
                />
              )
            )}
          </View>

          {calibrating ? (
            <AppText variant="body" style={styles.line}>
              Log your first squat, bench, or deadlift to get your reading.
            </AppText>
          ) : (
            <Animated.View style={[styles.rankWrap, slamStyle]}>
              <SfxLayer text={world.sfx.rankUp} size={110} opacity={0.12} color={world.aura} />
              <AppText variant="display" color={world.aura} style={styles.rank}>
                {reading!.rank.tier.label} {ROMAN[reading!.rank.subTier]}
              </AppText>
              <AppText variant="label" style={styles.line}>{world.series} world</AppText>
            </Animated.View>
          )}
        </View>

        <View style={styles.footer}>
          {slammed && <Button label="Start training" size="lg" fullWidth onPress={onStart} haptic="medium" />}
        </View>
      </View>
    </WorldScope>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg, padding: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.xl },
  ringBox: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  rankWrap: { alignItems: 'center', gap: Spacing.xs, minHeight: 90, justifyContent: 'center' },
  rank: { textAlign: 'center' },
  line: { textAlign: 'center', color: Colors.textSecondary, maxWidth: 300 },
  footer: { minHeight: 64, justifyContent: 'flex-end', paddingBottom: Spacing.lg },
});
