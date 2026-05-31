import { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { Colors } from '@/constants/colors';

interface Props {
  message: string;
  emoji?: string;
  visible: boolean;
  position?: 'top' | 'bottom';
}

export function FirstWorkoutTooltip({ message, emoji = '👆', visible, position = 'bottom' }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(position === 'bottom' ? 20 : -20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={{
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
      position: 'absolute',
      left: 16, right: 16,
      ...(position === 'bottom' ? { bottom: 100 } : { top: 120 }),
      zIndex: 1000,
      pointerEvents: 'none',
    }}>
      <View style={{
        backgroundColor: Colors.accent,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        shadowColor: Colors.accent,
        shadowOpacity: 0.4,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }}>
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700', flex: 1, lineHeight: 20 }}>
          {message}
        </Text>
      </View>
      {/* Arrow */}
      <View style={{
        alignSelf: 'center',
        width: 0, height: 0,
        borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        borderTopColor: Colors.accent,
        marginTop: -1,
        display: position === 'bottom' ? 'flex' : 'none',
      }} />
    </Animated.View>
  );
}
