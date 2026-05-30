import { useEffect, useState, useRef } from 'react';
import { View, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';

interface RestTimerProps {
  lastSetLoggedAt: Date | null;
}

export function RestTimer({ lastSetLoggedAt }: RestTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hapticFiredRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!lastSetLoggedAt) {
      setElapsed(0);
      hapticFiredRef.current.clear();
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    hapticFiredRef.current.clear();

    const tick = () => {
      const secs = Math.floor((Date.now() - lastSetLoggedAt.getTime()) / 1000);
      setElapsed(secs);

      // Haptic nudge at 90s and 180s — only once each
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

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [lastSetLoggedAt]);

  if (!lastSetLoggedAt) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const display = `${mins}:${secs.toString().padStart(2, '0')}`;

  // Color shifts: green 0-90s, amber 90-180s, red 180+
  const timerColor = elapsed < 90 ? Colors.success : elapsed < 180 ? Colors.gold : Colors.danger;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        gap: 8,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: timerColor }} />
      <Text
        style={{
          color: Colors.textMuted,
          fontSize: 11,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        }}
      >
        REST
      </Text>
      <Text
        style={{
          color: timerColor,
          fontSize: 15,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
          letterSpacing: 1,
        }}
      >
        {display}
      </Text>
    </View>
  );
}
