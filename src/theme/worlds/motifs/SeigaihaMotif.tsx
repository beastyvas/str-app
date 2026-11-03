import { memo } from 'react';
import { G, Path, Rect } from 'react-native-svg';
import { MotifCanvas } from './MotifCanvas';
import type { MotifProps } from '../types';
import { WORLD_COLORS } from '../palette';

const { aura: AURA, auraAlt: ALT } = WORLD_COLORS.mortal;
const R = 28;

// Seigaiha: rows of overlapping concentric half-rings, odd rows offset by R.
function wavePaths(): string[] {
  const out: string[] = [];
  for (let row = 0; row < 18; row++) {
    const y = row * (R * 0.5) + R;
    const offset = row % 2 === 0 ? 0 : R;
    for (let col = -1; col < 9; col++) {
      const cx = col * R * 2 + offset;
      for (const k of [1, 0.68, 0.36]) {
        const r = R * k;
        out.push(`M ${cx - r} ${y} A ${r} ${r} 0 0 1 ${cx + r} ${y}`);
      }
    }
  }
  return out;
}
const WAVES = wavePaths();

// A subtle checker block in the lower-left — the only second pattern.
const CHECKS: { x: number; y: number }[] = [];
for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if ((r + c) % 2 === 0) CHECKS.push({ x: c * 18, y: 328 + r * 18 });

export const SeigaihaMotif = memo(function SeigaihaMotif({ intensity, animated }: MotifProps) {
  return (
    <MotifCanvas intensity={intensity} animated={animated}>
      <G stroke={AURA} strokeWidth={1.6} fill="none">
        {WAVES.map((d, i) => <Path key={i} d={d} />)}
      </G>
      <G fill={ALT}>
        {CHECKS.map((c, i) => <Rect key={i} x={c.x} y={c.y} width={18} height={18} />)}
      </G>
    </MotifCanvas>
  );
});
