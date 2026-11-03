import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { G, Line } from 'react-native-svg';

interface SpeedLinesProps {
  color: string;
  count?: number;
  opacity?: number;
  /** Inner radius (0–1 of half-size) left clear in the middle */
  hole?: number;
}

/** Radial manga speed lines, absolutely filling the parent. */
export const SpeedLines = memo(function SpeedLines({ color, count = 48, opacity = 0.6, hole = 0.35 }: SpeedLinesProps) {
  const lines = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + (i % 3) * 0.02;
    const inner = 200 * (hole + (i % 4) * 0.06);
    return {
      x1: 200 + Math.cos(a) * inner, y1: 200 + Math.sin(a) * inner,
      x2: 200 + Math.cos(a) * 320, y2: 200 + Math.sin(a) * 320,
      w: 1 + (i % 5) * 0.8,
    };
  });
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" pointerEvents="none">
      <G stroke={color} opacity={opacity} strokeLinecap="round">
        {lines.map((l, i) => <Line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} strokeWidth={l.w} />)}
      </G>
    </Svg>
  );
});
