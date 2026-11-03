import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { Colors, Hit, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';

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

/**
 * One compact bar docked above the tab bar — not a modal. Tap −15 / +15 to
 * adjust the target for this kind of set (warmup or working); the choice
 * persists. The 1s tick lives here, so only this bar re-renders.
 */
export function RestTimer({ lastSetLoggedAt, lastSetWasWarmup = false }: RestTimerProps) {
  const world = useWorld();
  const [elapsed, setElapsed] = useState(0);
  const [warmupSec, setWarmupSec] = useState(DEFAULT_WARMUP);
  const [workingSec, setWorkingSec] = useState(DEFAULT_WORKING);
  const hapticFired = useRef<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.multiGet([WARMUP_KEY, WORKING_KEY]).then(pairs => {
      const map = Object.fromEntries(pairs);
      const w = parseInt(map[WARMUP_KEY] ?? '', 10);
      const k = parseInt(map[WORKING_KEY] ?? '', 10);
      if (!isNaN(w)) setWarmupSec(w);
      if (!isNaN(k)) setWorkingSec(k);
    });
  }, []);

  const target = lastSetWasWarmup ? warmupSec : workingSec;

  const adjust = (delta: number) => {
    Haptics.selectionAsync();
    const setter = lastSetWasWarmup ? setWarmupSec : setWorkingSec;
    const key = lastSetWasWarmup ? WARMUP_KEY : WORKING_KEY;
    setter(prev => {
      const next = Math.min(MAX_REST, Math.max(MIN_REST, prev + delta));
      AsyncStorage.setItem(key, String(next));
      return next;
    });
  };

  useEffect(() => {
    hapticFired.current.clear();
    if (!lastSetLoggedAt) { setElapsed(0); return; }
    const warnAt = Math.round(target * 0.8);
    const tick = () => {
      const secs = Math.floor((Date.now() - lastSetLoggedAt.getTime()) / 1000);
      setElapsed(secs);
      // Gentle nudge approaching the target, firmer one when rest is up
      if (secs >= warnAt && secs < target && !hapticFired.current.has('warn')) {
        hapticFired.current.add('warn');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      if (secs >= target && !hapticFired.current.has('done')) {
        hapticFired.current.add('done');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastSetLoggedAt, target]);

  if (!lastSetLoggedAt) return null;

  const done = elapsed >= target;
  const progress = Math.min(1, target > 0 ? elapsed / target : 0);
  const color = done ? Colors.success : world.aura;

  return (
    <View pointerEvents="box-none" style={styles.dock}>
      <View style={styles.bar} accessibilityRole="timer" accessibilityLabel={`Rest ${fmt(elapsed)} of ${fmt(target)}`}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: color + '33' }]} />
        <TouchableOpacity onPress={() => adjust(-STEP)} style={styles.adj} accessibilityLabel="Rest 15 seconds shorter">
          <AppText variant="stat" color={Colors.textSecondary} style={styles.adjText}>−15</AppText>
        </TouchableOpacity>
        <View style={styles.center}>
          <AppText variant="label">{done ? 'Rest done' : lastSetWasWarmup ? 'Warmup rest' : 'Rest'}</AppText>
          <AppText variant="stat" color={color}>{fmt(elapsed)}</AppText>
          <AppText variant="label" color={Colors.textMuted}>/ {fmt(target)}</AppText>
        </View>
        <TouchableOpacity onPress={() => adjust(STEP)} style={styles.adj} accessibilityLabel="Rest 15 seconds longer">
          <AppText variant="stat" color={Colors.textSecondary} style={styles.adjText}>+15</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.screenH, paddingBottom: Spacing.sm },
  bar: {
    flexDirection: 'row', alignItems: 'center', minHeight: Hit.log, overflow: 'hidden',
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.borderLight,
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  center: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: Spacing.sm },
  adj: { width: 64, minHeight: Hit.log, alignItems: 'center', justifyContent: 'center' },
  adjText: { fontSize: 16, lineHeight: 20 },
});
