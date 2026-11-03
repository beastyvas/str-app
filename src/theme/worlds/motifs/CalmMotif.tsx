import { memo } from 'react';
import { G, Line } from 'react-native-svg';
import { MotifCanvas } from './MotifCanvas';
import type { MotifProps } from '../types';

import { Colors } from '@/constants/colors';

const PAPER = Colors.paper;

// The joke: you're too strong to need effects. Two clean white rules.
export const CalmMotif = memo(function CalmMotif({ intensity }: MotifProps) {
  return (
    <MotifCanvas intensity={intensity}>
      <G stroke={PAPER} strokeWidth={1}>
        <Line x1={0} y1={96} x2={400} y2={96} />
        <Line x1={0} y1={304} x2={400} y2={304} />
      </G>
    </MotifCanvas>
  );
});
