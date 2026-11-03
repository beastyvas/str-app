import { memo } from 'react';
import { G, Line, Path } from 'react-native-svg';
import { MotifCanvas } from './MotifCanvas';
import type { MotifProps } from '../types';
import { WORLD_COLORS } from '../palette';

const { aura: AURA, auraAlt: ALT } = WORLD_COLORS.phantom;

// Aura flames licking up from the bottom edge, plus diagonal ki streaks.
function flame(x: number, w: number, h: number): string {
  const base = 400;
  return `M ${x - w / 2} ${base}
    C ${x - w / 2} ${base - h * 0.45}, ${x - w * 0.1} ${base - h * 0.55}, ${x} ${base - h}
    C ${x + w * 0.15} ${base - h * 0.6}, ${x + w / 2} ${base - h * 0.4}, ${x + w / 2} ${base} Z`;
}
const FLAMES = [
  flame(30, 70, 150), flame(90, 60, 210), flame(150, 80, 170), flame(215, 60, 240),
  flame(275, 80, 180), flame(335, 60, 220), flame(390, 70, 160),
];
const STREAKS = [
  [20, 60, 120, 20], [180, 90, 300, 40], [260, 150, 390, 95], [40, 170, 140, 130],
];

export const AuraFlameMotif = memo(function AuraFlameMotif({ intensity, animated }: MotifProps) {
  return (
    <MotifCanvas intensity={intensity} animated={animated}>
      <G fill={AURA}>
        {FLAMES.map((d, i) => <Path key={i} d={d} opacity={i % 2 ? 0.7 : 1} />)}
      </G>
      <G stroke={ALT} strokeWidth={3} strokeLinecap="round">
        {STREAKS.map(([x1, y1, x2, y2], i) => <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
      </G>
    </MotifCanvas>
  );
});
