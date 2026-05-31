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
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    slideAnim.setValue(-120);
    scaleAnim.setValue(0.8);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 60, tension: 80, friction: 9, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }),
      ]),
      Animated.delay(1800),
      Animated.timing(slideAnim, { toValue: -120, duration: 300, useNativeDriver: true }),
    ]).start(() => onDone());
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={{
      position: 'absolute', top: 0, left: 16, right: 16, zIndex: 9999,
      transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
    }}>
      <View style={{
        backgroundColor: Colors.surface,
        borderRadius: 18, padding: 16,
        flexDirection: 'row', alignItems: 'center', gap: 14,
        borderWidth: 1.5, borderColor: Colors.accent + '60',
        shadowColor: Colors.accent, shadowOpacity: 0.3,
        shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
        elevation: 12,
      }}>
        <View style={{
          width: 48, height: 48, borderRadius: 24,
          backgroundColor: Colors.accent + '20',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 26 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '900' }}>{title}</Text>
          {sub && <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>{sub}</Text>}
        </View>
        <Text style={{ color: Colors.accent, fontSize: 18 }}>✓</Text>
      </View>
    </Animated.View>
  );
}
