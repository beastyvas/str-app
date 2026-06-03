import { useEffect, useState, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';

interface RestTimerProps {
  lastSetLoggedAt: Date | null;
}

export function RestTimer({ lastSetLoggedAt }: RestTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hapticFiredRef = useRef<Set<number>>(new Set());
  const dotPulse = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!lastSetLoggedAt) {
      setElapsed(0);
      hapticFiredRef.current.clear();
      if (intervalRef.current) clearInterval(intervalRef.current);
      pulseLoop.current?.stop();
      return;
    }

    hapticFiredRef.current.clear();

    // Start dot pulse animation
    pulseLoop.current?.stop();
    dotPulse.setValue(1);
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();

    const tick = () => {
      const secs = Math.floor((Date.now() - lastSetLoggedAt.getTime()) / 1000);
      setElapsed(secs);

      if (secs === 90 && !hapticFiredRef.current.has(90)) {
        hapticFiredRef.current.add(90);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      if (secs === 180 && !hapticFiredRef.current.has(180)) {
        hapticFiredRef.current.add(180);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      pulseLoop.current?.stop();
    };
  }, [lastSetLoggedAt]);

  if (!lastSetLoggedAt) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const display = `${mins}:${secs.toString().padStart(2, '0')}`;

  const timerColor = elapsed < 90
    ? Colors.success
    : elapsed < 180
      ? Colors.gold
      : Colors.danger;

  const bgColor = elapsed < 90
    ? Colors.success + '12'
    : elapsed < 180
      ? Colors.gold + '12'
      : Colors.danger + '12';

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 20,
      backgroundColor: bgColor,
      borderBottomWidth: 1,
      borderBottomColor: timerColor + '25',
      gap: 10,
    }}>
      <Animated.View style={{
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: timerColor,
        opacity: dotPulse,
      }} />
      <Text style={{
        color: Colors.textMuted,
        fontSize: 10,
        letterSpacing: 2,
        textTransform: 'uppercase',
        fontWeight: '700',
      }}>
        Rest
      </Text>
      <Text style={{
        color: timerColor,
        fontSize: 18,
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
        letterSpacing: 1.5,
        textShadowColor: timerColor,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: elapsed >= 180 ? 8 : 0,
      }}>
        {display}
      </Text>
    </View>
  );
}
