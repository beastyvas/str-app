import { memo } from 'react';
import { Defs, G, Line, Path, RadialGradient, Rect, Stop, Circle } from 'react-native-svg';
import { MotifCanvas } from './MotifCanvas';
import type { MotifProps } from '../types';
import { WORLD_COLORS } from '../palette';

const { aura: AURA, auraAlt: ALT } = WORLD_COLORS.sovereign;

// Glowing "System" window frames on a faint grid, with shadow smoke at the base.
const GRID: number[] = Array.from({ length: 11 }, (_, i) => i * 40);
function bracket(x: number, y: number, w: number, h: number, c = 14): string {
  return [
    `M ${x} ${y + c} L ${x} ${y} L ${x + c} ${y}`,
    `M ${x + w - c} ${y} L ${x + w} ${y} L ${x + w} ${y + c}`,
    `M ${x + w} ${y + h - c} L ${x + w} ${y + h} L ${x + w - c} ${y + h}`,
    `M ${x + c} ${y + h} L ${x} ${y + h} L ${x} ${y + h - c}`,
  ].join(' ');
}

export const SystemWindowMotif = memo(function SystemWindowMotif({ intensity, animated }: MotifProps) {
  return (
    <MotifCanvas intensity={intensity} animated={animated}>
      <Defs>
        <RadialGradient id="shadow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={AURA} stopOpacity={0.9} />
          <Stop offset="1" stopColor={AURA} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <G stroke={ALT} strokeWidth={0.8}>
        {GRID.map(v => <Line key={`h${v}`} x1={0} y1={v} x2={400} y2={v} />)}
        {GRID.map(v => <Line key={`v${v}`} x1={v} y1={0} x2={v} y2={400} />)}
      </G>
      <G stroke={ALT} strokeWidth={3} fill="none">
        <Path d={bracket(40, 40, 200, 110)} />
        <Path d={bracket(220, 200, 150, 90)} />
      </G>
      <Rect x={40} y={40} width={200} height={110} fill={ALT} opacity={0.25} />
      {[80, 220, 340].map((cx, i) => (
        <Circle key={i} cx={cx} cy={400} r={110} fill="url(#shadow)" />
      ))}
    </MotifCanvas>
  );
});
