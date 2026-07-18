import { memo, useEffect, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';

export function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}:${s.toString().padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  return `${h}:${(m % 60).toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface ElapsedTimeProps {
  /** Workout start — Date or ISO string (Zustand may rehydrate as string) */
  startedAt: Date | string;
  style?: StyleProp<TextStyle>;
}

/**
 * Self-ticking duration readout. The 1s interval lives HERE, so the only
 * thing re-rendering every second is this one <Text> — not the whole
 * workout screen (which previously re-rendered every ExerciseCard/SetRow
 * per tick).
 */
export const ElapsedTime = memo(function ElapsedTime({ startedAt, style }: ElapsedTimeProps) {
  const startMs = (startedAt instanceof Date ? startedAt : new Date(startedAt)).getTime();
  const [sec, setSec] = useState(() => Math.max(0, Math.floor((Date.now() - startMs) / 1000)));

  useEffect(() => {
    const tick = () => setSec(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startMs]);

  return <Text style={style}>{formatElapsed(sec)}</Text>;
});
