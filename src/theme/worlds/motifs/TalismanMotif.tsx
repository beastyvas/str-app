import { memo } from 'react';
import { Circle, Defs, G, Line, RadialGradient, Rect, Stop } from 'react-native-svg';
import { MotifCanvas } from './MotifCanvas';
import type { MotifProps } from '../types';
import { WORLD_COLORS } from '../palette';

const { aura: AURA, auraAlt: ALT } = WORLD_COLORS.ascendant;

// Seal-paper strips hanging at slight angles, with abstract brush ticks
// (generic marks, not real script), over cursed-energy smoke at the base.
const STRIPS = [
  { x: 40, y: -20, rot: -6, h: 200 },
  { x: 140, y: -40, rot: 4, h: 170 },
  { x: 270, y: -10, rot: -3, h: 230 },
  { x: 350, y: -30, rot: 7, h: 160 },
];

export const TalismanMotif = memo(function TalismanMotif({ intensity, animated }: MotifProps) {
  return (
    <MotifCanvas intensity={intensity} animated={animated}>
      <Defs>
        <RadialGradient id="smoke" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={ALT} stopOpacity={0.9} />
          <Stop offset="1" stopColor={ALT} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {[60, 170, 300, 380].map((cx, i) => (
        <Circle key={i} cx={cx} cy={390 - (i % 2) * 20} r={90 + (i % 2) * 30} fill="url(#smoke)" />
      ))}
      {STRIPS.map((s, i) => (
        <G key={i} rotation={s.rot} origin={`${s.x + 18}, ${s.y}`}>
          <Rect x={s.x} y={s.y} width={36} height={s.h} fill="none" stroke={AURA} strokeWidth={2} />
          <G stroke={AURA} strokeWidth={3} strokeLinecap="round">
            {Array.from({ length: Math.floor(s.h / 34) }).map((_, j) => (
              <Line key={j} x1={s.x + 9} y1={s.y + 24 + j * 30} x2={s.x + 27} y2={s.y + 30 + j * 30} />
            ))}
          </G>
          <Circle cx={s.x + 18} cy={s.y + s.h - 18} r={8} fill="none" stroke={AURA} strokeWidth={2} />
        </G>
      ))}
    </MotifCanvas>
  );
});
