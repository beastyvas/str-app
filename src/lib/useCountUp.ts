import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from 'react-native-reanimated';

interface CountUpOptions {
  from?: number;
  duration?: number;
  /** Escalating haptic ticks while counting (onboarding reveal, summary) */
  haptics?: boolean;
  /** Start only when true */
  run?: boolean;
  onDone?: () => void;
}

/**
 * Animates an integer from `from` to `to` (ease-out cubic). Re-renders only
 * the component that owns it, so keep it in a leaf. Reduce Motion jumps to
 * the end value.
 */
export function useCountUp(to: number, { from = 0, duration = 1600, haptics, run = true, onDone }: CountUpOptions = {}) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(run && !reduce ? from : to);
  const raf = useRef<number | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!run) return;
    if (reduce || from === to) { setValue(to); doneRef.current?.(); return; }
    const start = Date.now();
    let lastTick = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (haptics) {
        // Ticks get closer together as the count climbs
        const gap = 220 - t * 160;
        const now = Date.now();
        if (now - lastTick > gap) {
          lastTick = now;
          Haptics.impactAsync(t > 0.7 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      }
      if (t < 1) raf.current = requestAnimationFrame(step);
      else doneRef.current?.();
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current != null) cancelAnimationFrame(raf.current); };
  }, [to, from, run, reduce]);

  return value;
}
