import { memo, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon } from 'react-native-svg';
import { AppText } from '@/components/ui/AppText';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useWorld, type WorldTheme } from '@/theme';
import { useCountUp } from '@/lib/useCountUp';
import { SfxLayer } from './SfxLayer';

interface PowerReadoutProps {
  /** null = calibrating (no data yet) */
  power: number | null;
  /** Show the `≈` prefix for partial readings */
  partial?: boolean;
  /** Within 5% of a rank-up — ゴゴゴ behind the number */
  menace?: boolean;
  /** Count up from this value (summary delta, onboarding reveal) */
  countFrom?: number;
  countDuration?: number;
  countHaptics?: boolean;
  onCountDone?: () => void;
  /** Force a specific world (dev preview, friend profile) */
  world?: WorldTheme;
  size?: number;
}

export const formatPower = (n: number) => n.toLocaleString('en-US');

/**
 * The Power Level numerals framed by the world's `powerReadout`: brush ensō,
 * comic burst, seal ring, scouter + flame aura, [ STATUS ] window, or plain.
 */
export function PowerReadout({
  power, partial, menace, countFrom, countDuration, countHaptics, onCountDone, world: forced, size = 240,
}: PowerReadoutProps) {
  const active = useWorld();
  const world = forced ?? active;
  const target = power ?? 0;
  const shown = useCountUp(target, {
    from: countFrom ?? target,
    duration: countDuration,
    haptics: countHaptics,
    run: power != null,
    onDone: onCountDone,
  });

  const numeral = power == null ? null : `${partial ? '≈' : ''}${formatPower(shown)}`;
  const fontSize = numeral && numeral.length > 5 ? 52 : 64;

  const content = (
    <View style={styles.center}>
      {menace && <SfxLayer text={world.sfx.menace} size={size * 0.5} opacity={0.14} color={world.aura} />}
      {numeral == null ? (
        <AppText variant="title" color={world.aura}>Calibrating</AppText>
      ) : (
        <AppText variant="power" style={{ fontSize, lineHeight: fontSize }} allowFontScaling={false}>
          {numeral}
        </AppText>
      )}
      <AppText variant="caption" style={styles.unit}>Power level</AppText>
    </View>
  );

  if (world.powerReadout === 'system') {
    return (
      <View style={[styles.system, { borderColor: world.aura, shadowColor: world.aura, width: size + 40 }]}>
        <AppText variant="label" color={world.aura} style={styles.systemTitle}>[ STATUS ]</AppText>
        <View style={[styles.systemRule, { backgroundColor: world.aura }]} />
        {content}
      </View>
    );
  }
  if (world.powerReadout === 'plain') {
    return (
      <View style={[styles.plain, { width: size }]}>
        {content}
        <View style={styles.plainRule} />
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <Frame world={world} size={size} />
      <View style={StyleSheet.absoluteFill}>{content}</View>
    </View>
  );
}

const Frame = memo(function Frame({ world, size }: { world: WorldTheme; size: number }) {
  const a = world.aura;
  const alt = world.auraAlt;
  let body: ReactNode = null;

  switch (world.powerReadout) {
    case 'brush': {
      // Ensō: an open, uneven brush circle.
      body = (
        <G fill="none" strokeLinecap="round">
          <Path d={arc(120, 120, 104, 300, 610)} stroke={a} strokeWidth={11} />
          <Path d={arc(122, 118, 98, 320, 560)} stroke={a} strokeWidth={4} opacity={0.6} />
        </G>
      );
      break;
    }
    case 'comic': {
      const pts = Array.from({ length: 32 }, (_, i) => {
        const r = i % 2 === 0 ? 116 : 96;
        const t = (i / 32) * Math.PI * 2;
        return `${120 + Math.cos(t) * r},${120 + Math.sin(t) * r}`;
      }).join(' ');
      body = (
        <G>
          <Polygon points={pts} fill={Colors.surface} stroke={Colors.ink} strokeWidth={6} />
          <Polygon points={pts} fill="none" stroke={a} strokeWidth={3} />
        </G>
      );
      break;
    }
    case 'seal': {
      body = (
        <G fill="none" stroke={a}>
          <Circle cx={120} cy={120} r={110} strokeWidth={2} />
          <Circle cx={120} cy={120} r={94} strokeWidth={1} />
          {Array.from({ length: 36 }, (_, i) => {
            const t = (i / 36) * Math.PI * 2;
            return <Line key={i} x1={120 + Math.cos(t) * 96} y1={120 + Math.sin(t) * 96} x2={120 + Math.cos(t) * 108} y2={120 + Math.sin(t) * 108} strokeWidth={i % 3 === 0 ? 2.5 : 1} />;
          })}
          {[0, 90, 180, 270].map(d => (
            <G key={d} rotation={d} origin="120, 120">
              <Polygon points="112,0 128,0 128,22 112,22" fill={Colors.bg} stroke={alt} strokeWidth={1.5} />
            </G>
          ))}
        </G>
      );
      break;
    }
    case 'scouter': {
      // Flame aura: spiky ring, then the scouter lens with crosshair ticks.
      const flame = Array.from({ length: 28 }, (_, i) => {
        const r = i % 2 === 0 ? 118 + (i % 4) * 2 : 102;
        const t = (i / 28) * Math.PI * 2 - Math.PI / 2;
        return `${120 + Math.cos(t) * r},${120 + Math.sin(t) * r}`;
      }).join(' ');
      body = (
        <G>
          <Polygon points={flame} fill={a} opacity={0.18} />
          <Circle cx={120} cy={120} r={98} fill="none" stroke={a} strokeWidth={2} />
          <Path d={arc(120, 120, 88, 200, 340)} fill="none" stroke={alt} strokeWidth={3} />
          <G stroke={a} strokeWidth={1.5}>
            <Line x1={120} y1={14} x2={120} y2={34} />
            <Line x1={120} y1={206} x2={120} y2={226} />
            <Line x1={14} y1={120} x2={30} y2={120} />
            <Line x1={210} y1={120} x2={226} y2={120} />
          </G>
        </G>
      );
      break;
    }
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" style={StyleSheet.absoluteFill} pointerEvents="none">
      {body}
    </Svg>
  );
});

/** SVG arc path from startDeg to endDeg (may exceed 360). */
function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const p = (d: number) => {
    const t = (d * Math.PI) / 180;
    return `${cx + Math.cos(t) * r} ${cy + Math.sin(t) * r}`;
  };
  const sweep = endDeg - startDeg;
  // Split into ≤180° segments so the large-arc flag stays unambiguous.
  const segs = Math.ceil(sweep / 180);
  let d = `M ${p(startDeg)}`;
  for (let i = 1; i <= segs; i++) {
    const e = startDeg + (sweep * i) / segs;
    d += ` A ${r} ${r} 0 0 1 ${p(e)}`;
  }
  return d;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
  unit: { color: Colors.textSecondary },
  system: {
    borderWidth: 1.5,
    backgroundColor: Colors.bg + 'E6',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    height: 220,
    shadowOpacity: 0.7,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  systemTitle: { fontFamily: Fonts.hud, textAlign: 'center', letterSpacing: 2 },
  systemRule: { height: 1, marginTop: Spacing.sm, opacity: 0.6 },
  plain: { height: 180, alignItems: 'center' },
  plainRule: { height: 1, alignSelf: 'stretch', backgroundColor: Colors.paper, opacity: 0.5 },
});
