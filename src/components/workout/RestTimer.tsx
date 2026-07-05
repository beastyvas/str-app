import { useEffect, useState, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';

interface RestTimerProps {
  lastSetLoggedAt: Date | null;
  lastSetWasWarmup?: boolean;
}

const WARMUP_KEY = 'rest_warmup_sec';
const WORKING_KEY = 'rest_working_sec';
const DEFAULT_WARMUP = 60;
const DEFAULT_WORKING = 180;
const STEP = 15;
const MIN_REST = 15;
const MAX_REST = 600;

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RestTimer({ lastSetLoggedAt, lastSetWasWarmup = false }: RestTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [warmupSec, setWarmupSec] = useState(DEFAULT_WARMUP);
  const [workingSec, setWorkingSec] = useState(DEFAULT_WORKING);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hapticFiredRef = useRef<Set<string>>(new Set());
  const dotPulse = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Load saved rest durations once
  useEffect(() => {
    AsyncStorage.multiGet([WARMUP_KEY, WORKING_KEY]).then(pairs => {
      const map = Object.fromEntries(pairs);
      const w = parseInt(map[WARMUP_KEY] ?? '', 10);
      const k = parseInt(map[WORKING_KEY] ?? '', 10);
      if (!isNaN(w)) setWarmupSec(w);
      if (!isNaN(k)) setWorkingSec(k);
    });
  }, []);

  // Which target applies to the rest that just started
  const target = lastSetWasWarmup ? warmupSec : workingSec;

  const adjust = (which: 'warmup' | 'working', delta: number) => {
    Haptics.selectionAsync();
    if (which === 'warmup') {
      setWarmupSec(prev => {
        const next = Math.min(MAX_REST, Math.max(MIN_REST, prev + delta));
        AsyncStorage.setItem(WARMUP_KEY, String(next));
        return next;
      });
    } else {
      setWorkingSec(prev => {
        const next = Math.min(MAX_REST, Math.max(MIN_REST, prev + delta));
        AsyncStorage.setItem(WORKING_KEY, String(next));
        return next;
      });
    }
  };

  useEffect(() => {
    if (!lastSetLoggedAt) {
      setElapsed(0);
      setSettingsOpen(false);
      hapticFiredRef.current.clear();
      if (intervalRef.current) clearInterval(intervalRef.current);
      pulseLoop.current?.stop();
      return;
    }

    hapticFiredRef.current.clear();

    pulseLoop.current?.stop();
    dotPulse.setValue(1);
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();

    const warnAt = Math.round(target * 0.8);
    const tick = () => {
      const secs = Math.floor((Date.now() - lastSetLoggedAt.getTime()) / 1000);
      setElapsed(secs);

      // Gentle nudge approaching the target, firmer one when rest is up
      if (secs >= warnAt && secs < target && !hapticFiredRef.current.has('warn')) {
        hapticFiredRef.current.add('warn');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      if (secs >= target && !hapticFiredRef.current.has('done')) {
        hapticFiredRef.current.add('done');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      pulseLoop.current?.stop();
    };
    // re-run if the target changes (different set type or edited duration)
  }, [lastSetLoggedAt, target]);

  if (!lastSetLoggedAt) return null;

  const done = elapsed >= target;
  const almost = !done && elapsed >= target * 0.8;
  const timerColor = done ? Colors.danger : almost ? Colors.gold : Colors.success;
  const bgColor = (done ? Colors.danger : almost ? Colors.gold : Colors.success) + '12';

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setSettingsOpen(o => !o)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
          paddingHorizontal: 20,
          backgroundColor: bgColor,
          borderBottomWidth: 1,
          borderBottomColor: timerColor + '25',
          gap: 10,
        }}
      >
        <Animated.View style={{
          width: 7, height: 7, borderRadius: 3.5,
          backgroundColor: timerColor, opacity: dotPulse,
        }} />
        <Text style={{
          color: Colors.textMuted, fontSize: 10, letterSpacing: 2,
          textTransform: 'uppercase', fontWeight: '700',
        }}>
          {lastSetWasWarmup ? 'Warmup Rest' : 'Rest'}
        </Text>
        <Text style={{
          color: timerColor, fontSize: 18, fontWeight: '800',
          fontVariant: ['tabular-nums'], letterSpacing: 1.5,
          textShadowColor: timerColor, textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: done ? 8 : 0,
        }}>
          {fmt(elapsed)}
        </Text>
        <Text style={{ color: Colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] }}>
          / {fmt(target)}
        </Text>
        <Text style={{ color: Colors.textMuted, fontSize: 11, opacity: 0.6 }}>
          {settingsOpen ? '▲' : '⚙'}
        </Text>
      </TouchableOpacity>

      {/* Inline duration settings — tap the bar to open */}
      {settingsOpen && (
        <View style={{
          backgroundColor: Colors.surface,
          borderBottomWidth: 1, borderBottomColor: Colors.border,
          paddingHorizontal: 20, paddingVertical: 12, gap: 10,
        }}>
          {([
            { label: 'Warmup rest', which: 'warmup' as const, value: warmupSec },
            { label: 'Working rest', which: 'working' as const, value: workingSec },
          ]).map(row => (
            <View key={row.which} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{row.label}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <TouchableOpacity
                  onPress={() => adjust(row.which, -STEP)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '800' }}>−</Text>
                </TouchableOpacity>
                <Text style={{
                  color: Colors.text, fontSize: 14, fontWeight: '800',
                  fontVariant: ['tabular-nums'], minWidth: 48, textAlign: 'center',
                }}>
                  {fmt(row.value)}
                </Text>
                <TouchableOpacity
                  onPress={() => adjust(row.which, STEP)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '800' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <Text style={{ color: Colors.textMuted, fontSize: 11, lineHeight: 16 }}>
            Warmup sets use the shorter rest automatically. The timer still starts on its own after every set.
          </Text>
        </View>
      )}
    </View>
  );
}
