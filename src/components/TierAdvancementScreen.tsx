import { useEffect, useRef } from 'react';
import { View, Animated, Modal, Dimensions, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/theme';
import { RankUpScene } from '@/components/anime/RankUpScene';
import { WORLDS } from '@/theme/worlds';
import { RankTier, ROMAN } from '@/constants/ranks';

interface Props {
  visible: boolean;
  tier: RankTier | null;
  subTier?: number;
  isSubTierAdvance?: boolean;
  liftName?: string;
  liftTierName?: string;
  liftTierColor?: string;
  onDismiss: () => void;
}

const { width } = Dimensions.get('window');

export function TierAdvancementScreen({
  visible,
  tier,
  subTier,
  isSubTierAdvance = false,
  liftName,
  liftTierName,
  liftTierColor,
  onDismiss,
}: Props) {
  const isLiftAdvance = !!liftName;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const hintAnim = useRef(new Animated.Value(0)).current;
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible || !tier) return;

    fadeAnim.setValue(0);
    scaleAnim.setValue(0.5);
    glowAnim.setValue(0);
    taglineAnim.setValue(0);
    ringScale.setValue(0.6);
    ringOpacity.setValue(0);
    hintAnim.setValue(0);

    // Ring pulse loop — starts after main reveal
    const ringLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1.5, duration: 1200, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 0.6, duration: 0, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(200),
        Animated.timing(ringOpacity, { toValue: 0.3, duration: 0, useNativeDriver: true }),
      ]),
    );

    Haptics.impactAsync(isSubTierAdvance || isLiftAdvance ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]),
      Animated.delay(150),
      Animated.timing(taglineAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(hintAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      ringLoop.start();
    });

    const totalDuration = isLiftAdvance ? 3500 : isSubTierAdvance ? 4000 : 5000;
    autoTimer.current = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => onDismiss());
    }, totalDuration);

    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      ringLoop.stop();
    };
  }, [visible, tier]);

  const handleTap = () => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    Animated.timing(fadeAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => onDismiss());
  };

  if (!tier) return null;

  const activeColor = isLiftAdvance
    ? (liftTierColor ?? tier.color ?? Colors.accent)
    : (tier.color ?? Colors.accent);

  const heroText = isLiftAdvance
    ? liftTierName ?? ''
    : isSubTierAdvance && subTier
      ? `${tier.label} ${ROMAN[subTier]}`
      : tier.label;

  const topLabel = isLiftAdvance
    ? `${liftName ?? 'Lift'} tier up`
    : isSubTierAdvance
      ? 'Level up'
      : 'Rank up';

  const tagline = isLiftAdvance
    ? `New ${liftName?.toLowerCase() ?? ''} tier unlocked.`
    : isSubTierAdvance
      ? `${tier.label} ${ROMAN[subTier ?? 1]} unlocked.`
      : tier.tagline;

  // Restyle only: the timing, auto-dismiss and tap logic above are unchanged.
  // The world's signature RankUpScene plays behind the text.
  const world = WORLDS[tier.key] ?? WORLDS.mortal;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <TouchableOpacity activeOpacity={1} onPress={handleTap} style={styles.fill} accessibilityLabel="Continue">
        <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
          {!isLiftAdvance && <RankUpScene world={world} playKey={`${tier.key}-${subTier ?? 0}`} />}

          {/* Aura ring pulse */}
          <Animated.View style={[styles.ring, {
            width: width * 0.7, height: width * 0.7, borderRadius: width * 0.35,
            borderColor: activeColor, opacity: ringOpacity, transform: [{ scale: ringScale }],
          }]} />

          <Animated.Text style={[styles.top, { color: activeColor, opacity: fadeAnim }]}>{topLabel}</Animated.Text>

          <Animated.Text style={[styles.hero, {
            color: activeColor,
            fontSize: heroText.length > 12 ? 34 : heroText.length > 8 ? 42 : 52,
            lineHeight: heroText.length > 12 ? 42 : heroText.length > 8 ? 52 : 62,
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }]}>
            {heroText}
          </Animated.Text>

          {isSubTierAdvance && subTier && (
            <Animated.View style={[styles.dots, { opacity: fadeAnim }]}>
              {[1, 2, 3, 4].map(n => (
                <View key={n} style={[styles.dot, { backgroundColor: n <= subTier ? activeColor : activeColor + '30' }]} />
              ))}
            </Animated.View>
          )}

          {!isLiftAdvance && (
            <Animated.Text style={[styles.series, { opacity: taglineAnim }]}>{world.series} world</Animated.Text>
          )}
          <Animated.Text style={[styles.tagline, { opacity: taglineAnim }]}>{tagline}</Animated.Text>
          <Animated.Text style={[styles.hint, { opacity: hintAnim }]}>Tap to continue</Animated.Text>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  root: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ring: { position: 'absolute', borderWidth: 1.5 },
  top: { fontFamily: Fonts.bodySemi, fontSize: 15, marginBottom: 20 },
  hero: { fontFamily: Fonts.display, textAlign: 'center', marginBottom: 20, paddingHorizontal: 20 },
  dots: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  dot: { width: 12, height: 12, transform: [{ rotate: '45deg' }] },
  series: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  tagline: { fontFamily: Fonts.body, fontSize: 15, lineHeight: 22, color: Colors.text, textAlign: 'center', paddingHorizontal: 48 },
  hint: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 56 },
});
