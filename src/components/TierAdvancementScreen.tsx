import { useEffect, useRef } from 'react';
import { View, Text, Animated, Modal, Dimensions } from 'react-native';
import { Colors } from '@/constants/colors';
import { AnimeTier, ROMAN } from '@/constants/animeTiers';

interface Props {
  visible: boolean;
  tier: AnimeTier | null;
  subTier?: number;
  isSubTierAdvance?: boolean;
  liftName?: string;       // e.g. "SQUAT" — shows lift-specific advance
  liftTierName?: string;   // e.g. "SILVER" — the new tier for that lift
  liftTierColor?: string;
  onDismiss: () => void;
}

const { width } = Dimensions.get('window');

export function TierAdvancementScreen({ visible, tier, subTier, isSubTierAdvance = false, liftName, liftTierName, liftTierColor, onDismiss }: Props) {
  const isLiftAdvance = !!liftName;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !tier) return;

    fadeAnim.setValue(0);
    scaleAnim.setValue(0.6);
    glowAnim.setValue(0);
    taglineAnim.setValue(0);

    Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(200),
      Animated.timing(taglineAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(isLiftAdvance ? 1400 : isSubTierAdvance ? 1600 : 2200),
      Animated.timing(fadeAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }, [visible, tier]);

  if (!tier) return null;

  const activeColor = isLiftAdvance ? (liftTierColor ?? tier?.color ?? Colors.accent) : (tier?.color ?? Colors.accent);
  const heroText = isLiftAdvance
    ? liftTierName ?? ''
    : isSubTierAdvance && subTier
      ? `${tier!.label} ${ROMAN[subTier]}`
      : tier!.label;
  const topLabel = isLiftAdvance ? liftName ?? 'PR' : isSubTierAdvance ? 'LEVEL UP' : 'RANK UP';
  const tagline = isLiftAdvance
    ? `New ${liftName?.toLowerCase() ?? ''} tier unlocked.`
    : isSubTierAdvance
      ? `${tier!.label} ${ROMAN[subTier ?? 1]} unlocked.`
      : tier!.tagline;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={{
        flex: 1,
        backgroundColor: Colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeAnim,
      }}>
        {/* Radial glow */}
        <Animated.View style={{
          position: 'absolute',
          width: width * 1.4,
          height: width * 1.4,
          borderRadius: width * 0.7,
          backgroundColor: activeColor,
          opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, isSubTierAdvance ? 0.05 : 0.08] }),
        }} />
        <Animated.View style={{
          position: 'absolute',
          width: width * 0.8,
          height: width * 0.8,
          borderRadius: width * 0.4,
          backgroundColor: activeColor,
          opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, isSubTierAdvance ? 0.08 : 0.12] }),
        }} />

        {/* Top label */}
        <Animated.Text style={{
          color: activeColor,
          fontSize: 11,
          fontWeight: '900',
          letterSpacing: 5,
          textTransform: 'uppercase',
          marginBottom: 20,
          opacity: fadeAnim,
        }}>
          {topLabel}
        </Animated.Text>

        {/* Hero tier name */}
        <Animated.Text style={{
          color: activeColor,
          fontSize: heroText.length > 12 ? 38 : heroText.length > 8 ? 46 : 56,
          fontWeight: '900',
          letterSpacing: -2,
          textAlign: 'center',
          marginBottom: 20,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          textShadowColor: activeColor,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: isSubTierAdvance ? 12 : 20,
        }}>
          {heroText}
        </Animated.Text>

        {/* Sub-tier dots — show all 4, fill up to current */}
        {isSubTierAdvance && subTier && (
          <Animated.View style={{
            flexDirection: 'row',
            gap: 8,
            marginBottom: 20,
            opacity: fadeAnim,
          }}>
            {[1, 2, 3, 4].map(n => (
              <View key={n} style={{
                width: n <= subTier ? 10 : 8,
                height: n <= subTier ? 10 : 8,
                borderRadius: 5,
                backgroundColor: n <= subTier ? activeColor : activeColor + '30',
                borderWidth: n === subTier ? 0 : 1,
                borderColor: activeColor + '40',
              }} />
            ))}
          </Animated.View>
        )}

        {/* Divider */}
        <Animated.View style={{
          width: 48, height: 2,
          backgroundColor: activeColor,
          opacity: fadeAnim,
          marginBottom: 20,
        }} />

        {/* Tagline */}
        <Animated.Text style={{
          color: Colors.textSecondary,
          fontSize: isSubTierAdvance ? 13 : 15,
          fontStyle: 'italic',
          textAlign: 'center',
          paddingHorizontal: 48,
          lineHeight: 22,
          opacity: taglineAnim,
        }}>
          "{tagline}"
        </Animated.Text>
      </Animated.View>
    </Modal>
  );
}
