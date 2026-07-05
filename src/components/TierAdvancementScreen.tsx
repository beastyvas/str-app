import { useEffect, useRef } from 'react';
import { View, Text, Animated, Modal, Dimensions, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/colors';
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
    ? liftName ?? 'PR'
    : isSubTierAdvance
      ? 'LEVEL UP'
      : 'RANK UP';

  const tagline = isLiftAdvance
    ? `New ${liftName?.toLowerCase() ?? ''} tier unlocked.`
    : isSubTierAdvance
      ? `${tier.label} ${ROMAN[subTier ?? 1]} unlocked.`
      : tier.tagline;

  const outerGlowSize = width * 1.5;
  const innerGlowSize = width * 0.9;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleTap}
        style={{ flex: 1 }}
      >
        <Animated.View style={{
          flex: 1,
          backgroundColor: Colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: fadeAnim,
        }}>
          {/* Outer radial glow */}
          <Animated.View style={{
            position: 'absolute',
            width: outerGlowSize,
            height: outerGlowSize,
            borderRadius: outerGlowSize / 2,
            backgroundColor: activeColor,
            opacity: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, isSubTierAdvance ? 0.05 : 0.09],
            }),
          }} />

          {/* Inner glow */}
          <Animated.View style={{
            position: 'absolute',
            width: innerGlowSize,
            height: innerGlowSize,
            borderRadius: innerGlowSize / 2,
            backgroundColor: activeColor,
            opacity: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, isSubTierAdvance ? 0.08 : 0.14],
            }),
          }} />

          {/* Pulsing ring */}
          <Animated.View style={{
            position: 'absolute',
            width: width * 0.7,
            height: width * 0.7,
            borderRadius: width * 0.35,
            borderWidth: 1.5,
            borderColor: activeColor,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          }} />

          {/* Top label */}
          <Animated.Text style={{
            color: activeColor,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 5,
            textTransform: 'uppercase',
            marginBottom: 24,
            opacity: fadeAnim,
          }}>
            {topLabel}
          </Animated.Text>

          {/* Hero tier name */}
          <Animated.Text style={{
            color: activeColor,
            fontSize: heroText.length > 12 ? 38 : heroText.length > 8 ? 46 : 58,
            fontWeight: '800',
            letterSpacing: -2,
            textAlign: 'center',
            marginBottom: 24,
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
            textShadowColor: activeColor,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: isSubTierAdvance ? 16 : 28,
          }}>
            {heroText}
          </Animated.Text>

          {/* Sub-tier dots */}
          {isSubTierAdvance && subTier && (
            <Animated.View style={{
              flexDirection: 'row',
              gap: 10,
              marginBottom: 24,
              opacity: fadeAnim,
            }}>
              {[1, 2, 3, 4].map(n => (
                <View key={n} style={{
                  width: n <= subTier ? 12 : 8,
                  height: n <= subTier ? 12 : 8,
                  borderRadius: 6,
                  backgroundColor: n <= subTier ? activeColor : activeColor + '25',
                  borderWidth: n === subTier ? 0 : 1,
                  borderColor: activeColor + '50',
                  shadowColor: n === subTier ? activeColor : 'transparent',
                  shadowOpacity: 0.6,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 0 },
                }} />
              ))}
            </Animated.View>
          )}

          {/* Divider */}
          <Animated.View style={{
            width: 56,
            height: 2,
            backgroundColor: activeColor,
            opacity: fadeAnim,
            marginBottom: 24,
            shadowColor: activeColor,
            shadowOpacity: 0.8,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
          }} />

          {/* Tagline */}
          <Animated.Text style={{
            color: Colors.textSecondary,
            fontSize: isSubTierAdvance ? 13 : 15,
            fontStyle: 'italic',
            textAlign: 'center',
            paddingHorizontal: 52,
            lineHeight: 24,
            opacity: taglineAnim,
          }}>
            "{tagline}"
          </Animated.Text>

          {/* Tap hint */}
          <Animated.Text style={{
            color: activeColor + '60',
            fontSize: 10,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginTop: 64,
            opacity: hintAnim,
          }}>
            Tap to continue
          </Animated.Text>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}
