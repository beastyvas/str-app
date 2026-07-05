import { useEffect, useRef } from 'react';
import { Animated, View, Text, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';

interface Props {
  visible: boolean;
  emoji: string;
  title: string;
  sub?: string;
  onDone: () => void;
}

const { width } = Dimensions.get('window');

export function CelebrationToast({ visible, emoji, title, sub, onDone }: Props) {
  const slideAnim = useRef(new Animated.Value(-140)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    slideAnim.setValue(-140);
    scaleAnim.setValue(0.85);
    opacityAnim.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 56,
          tension: 90,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 90,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(2800),
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -140,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => onDone());
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={{
      position: 'absolute',
      top: 0,
      left: 14,
      right: 14,
      zIndex: 9999,
      transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
      opacity: opacityAnim,
    }}>
      <View style={{
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderWidth: 1.5,
        borderColor: Colors.accent + '70',
        shadowColor: Colors.accent,
        shadowOpacity: 0.45,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 10 },
        elevation: 16,
      }}>
        {/* Accent glow swatch */}
        <View style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: Colors.accent + '25',
          borderWidth: 1.5,
          borderColor: Colors.accent + '50',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 28 }}>{emoji}</Text>
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{
            color: Colors.text,
            fontSize: 15,
            fontWeight: '800',
            letterSpacing: -0.3,
          }}>
            {title}
          </Text>
          {sub && (
            <Text style={{
              color: Colors.textSecondary,
              fontSize: 12,
              lineHeight: 17,
            }}>
              {sub}
            </Text>
          )}
        </View>

        <View style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: Colors.accent + '20',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ color: Colors.accent, fontSize: 16, fontWeight: '800' }}>✓</Text>
        </View>
      </View>
    </Animated.View>
  );
}
