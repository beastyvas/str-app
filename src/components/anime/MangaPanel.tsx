import { ReactNode, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { Colors, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import type { MotifIntensity } from '@/theme';

interface MangaPanelProps {
  children: ReactNode;
  /** Border color — defaults to the world aura */
  color?: string;
  fill?: string;
  /** Render the world motif inside the panel */
  motif?: MotifIntensity;
  animatedMotif?: boolean;
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Hero panel geometry shared by every world: one diagonal-cut corner
 * (top-right), a 2px aura border, no drop shadow. Use for a screen's ONE hero;
 * everything else is a plain grouped list.
 */
export function MangaPanel({
  children, color, fill = Colors.surface, motif, animatedMotif, padding = Spacing.xl, style,
}: MangaPanelProps) {
  const world = useWorld();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };
  const c = world.panel.cutCorner * 2;
  const b = world.panel.borderWidth;
  const half = b / 2;
  const { w, h } = size;
  const points = `${half},${half} ${w - c},${half} ${w - half},${c} ${w - half},${h - half} ${half},${h - half}`;
  const Motif = world.Motif;

  return (
    <View style={[styles.wrap, style]} onLayout={onLayout}>
      {w > 0 && (
        <Svg style={StyleSheet.absoluteFill} width={w} height={h} pointerEvents="none">
          <Polygon points={points} fill={fill} stroke={color ?? world.aura} strokeWidth={b} />
        </Svg>
      )}
      {motif && w > 0 && (
        <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
          <Motif intensity={motif} animated={animatedMotif} />
        </View>
      )}
      <View style={{ padding }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  // The motif clips to the panel's box; the cut corner keeps the border on top visually.
  clip: { overflow: 'hidden', margin: 2 },
});
