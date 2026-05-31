import { useEffect, useRef } from 'react';
import { View, Text, Animated, Modal, Dimensions } from 'react-native';
import { Colors } from '@/constants/colors';
import { AnimeTier } from '@/constants/animeTiers';

interface Props {
  visible: boolean;
  tier: AnimeTier | null;
  onDismiss: () => void;
}

const { width, height } = Dimensions.get('window');

export function TierAdvancementScreen({ visible, tier, onDismiss }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !tier) return;

    // Reset
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.6);
    glowAnim.setValue(0);
    taglineAnim.setValue(0);

    // Sequence: glow in → scale + fade title → fade tagline → hold → fade out
    Animated.sequence([
      // Glow pulse
      Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      // Title appears
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      // Short hold
      Animated.delay(200),
      // Tagline fades in
      Animated.timing(taglineAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      // Hold at full visibility
      Animated.delay(2200),
      // Fade everything out
      Animated.timing(fadeAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }, [visible, tier]);

  if (!tier) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={{
        flex: 1,
        backgroundColor: Colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeAnim,
      }}>
        {/* Radial glow background */}
        <Animated.View style={{
          position: 'absolute',
          width: width * 1.4,
          height: width * 1.4,
          borderRadius: width * 0.7,
          backgroundColor: tier.color,
          opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }),
        }} />
        <Animated.View style={{
          position: 'absolute',
          width: width * 0.8,
          height: width * 0.8,
          borderRadius: width * 0.4,
          backgroundColor: tier.color,
          opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }),
        }} />

        {/* RANK UP label */}
        <Animated.Text style={{
          color: tier.color,
          fontSize: 11,
          fontWeight: '900',
          letterSpacing: 5,
          textTransform: 'uppercase',
          marginBottom: 20,
          opacity: fadeAnim,
        }}>
          RANK UP
        </Animated.Text>

        {/* Tier name — the hero element */}
        <Animated.Text style={{
          color: tier.color,
          fontSize: tier.label.length > 10 ? 42 : 56,
          fontWeight: '900',
          letterSpacing: -2,
          textAlign: 'center',
          marginBottom: 20,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          textShadowColor: tier.color,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 20,
        }}>
          {tier.label}
        </Animated.Text>

        {/* Divider line */}
        <Animated.View style={{
          width: 48, height: 2,
          backgroundColor: tier.color,
          opacity: fadeAnim,
          marginBottom: 20,
        }} />

        {/* Tagline */}
        <Animated.Text style={{
          color: Colors.textSecondary,
          fontSize: 15,
          fontStyle: 'italic',
          textAlign: 'center',
          paddingHorizontal: 48,
          lineHeight: 24,
          opacity: taglineAnim,
        }}>
          "{tier.tagline}"
        </Animated.Text>
      </Animated.View>
    </Modal>
  );
}
