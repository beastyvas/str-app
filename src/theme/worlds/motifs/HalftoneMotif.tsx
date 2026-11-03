import { memo } from 'react';
import { Circle, G, Line } from 'react-native-svg';
import { MotifCanvas } from './MotifCanvas';
import type { MotifProps } from '../types';
import { WORLD_COLORS } from '../palette';

const { aura: AURA, auraAlt: ALT } = WORLD_COLORS.awakened;
const STEP = 16;

// Comic-book halftone: dots that grow toward the top-right corner.
const DOTS: { x: number; y: number; r: number }[] = [];
for (let y = 0; y <= 400; y += STEP) {
  for (let x = (y / STEP) % 2 === 0 ? 0 : STEP / 2; x <= 400; x += STEP) {
    const t = Math.max(0, (x - y + 400) / 800); // 0 bottom-left → 1 top-right
    const r = t * t * 6.5;
    if (r > 0.6) DOTS.push({ x, y, r });
  }
}

export const HalftoneMotif = memo(function HalftoneMotif({ intensity, animated }: MotifProps) {
  return (
    <MotifCanvas intensity={intensity} animated={animated}>
      <G fill={AURA}>
        {DOTS.map((d, i) => <Circle key={i} cx={d.x} cy={d.y} r={d.r} />)}
      </G>
      {/* Bold panel gutters */}
      <G stroke={ALT} strokeWidth={6}>
        <Line x1={250} y1={0} x2={190} y2={400} />
        <Line x1={0} y1={290} x2={400} y2={250} />
      </G>
    </MotifCanvas>
  );
});
