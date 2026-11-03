import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent, PanResponder, Pressable, StyleSheet, useWindowDimensions, View,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Svg, { Polygon } from 'react-native-svg';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/AppText';
import { SpeedLines } from '@/components/anime/SpeedLines';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { CHARACTERS } from '@/constants/cameos';
import { WORLD_CAST, type CharacterId } from '@/constants/cast';
import { RANK_TIERS } from '@/constants/ranks';
import { WORLDS, useWorld } from '@/theme';
import { useCameoStore, type CameoItem } from './useCameoStore';

const PORTRAIT_H = 180;
const PORTRAIT_W = 135;
const TYPE_MS = 25;
const LINGER_MS = 4000;
const TAB_BAR = 96;

/**
 * Mounted once near the root. Plays the cameo queue one item at a time.
 * Never auto-dismisses until 4s AFTER the text finishes typing; tapping the
 * bubble pins it open. Swipe down (or tap outside, off-workout) dismisses.
 */
export function Cameo({ host = 'root' }: { host?: 'root' | 'local' }) {
  const item = useCameoStore(s => s.queue[0]);
  const dismiss = useCameoStore(s => s.dismiss);
  const localHosts = useCameoStore(s => s.localHosts);
  const setLocalHost = useCameoStore(s => s.setLocalHost);
  // Native modals (e.g. the workout summary) sit above the root view, so they
  // mount a local host; the root host yields while one is mounted.
  useEffect(() => {
    if (host !== 'local') return;
    setLocalHost(true);
    return () => setLocalHost(false);
  }, [host]);
  if (!item || (host === 'root' && localHosts > 0)) return null;
  if (item.kind === 'castUnlock') return <CastUnlock key={item.id} tier={item.tier} onDone={dismiss} />;
  return <CameoBeatView key={item.id} item={item} onDone={dismiss} />;
}

function CameoBeatView({ item, onDone }: { item: Extract<CameoItem, { kind: 'beat' }>; onDone: () => void }) {
  const { beat, passThrough } = item;
  const reduce = useReducedMotion();
  const world = useWorld();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSystem = beat.speaker === 'system';
  const ch = isSystem ? null : CHARACTERS[beat.speaker as CharacterId];

  const [typed, setTyped] = useState(reduce ? beat.text.length : 0);
  const [pinned, setPinned] = useState(false);
  const done = typed >= beat.text.length;
  const closing = useRef(false);

  const enter = useSharedValue(reduce ? 0 : 1); // 1 = offscreen, 0 = resting
  const fade = useSharedValue(0);
  const flash = useSharedValue(0);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    if (reduce) {
      fade.value = withTiming(0, { duration: 160 }, f => { if (f) runOnJS(onDone)(); });
    } else {
      enter.value = withTiming(1, { duration: 220, easing: Easing.in(Easing.cubic) });
      fade.value = withTiming(0, { duration: 220 }, f => { if (f) runOnJS(onDone)(); });
    }
  };

  // Enter
  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fade.value = withTiming(1, { duration: reduce ? 200 : 140 });
    if (!reduce) {
      enter.value = withSpring(0, { damping: 11, stiffness: 140, overshootClamping: false });
      if (beat.hype) flash.value = withSequence(withTiming(0.85, { duration: 90 }), withTiming(0, { duration: 420 }));
    }
  }, []);

  // Typing (~25ms/char)
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setTyped(n => Math.min(beat.text.length, n + 1)), TYPE_MS);
    return () => clearInterval(t);
  }, [done]);

  // Linger 4s after the text finishes, unless pinned
  useEffect(() => {
    if (!done || pinned) return;
    const t = setTimeout(close, LINGER_MS);
    return () => clearTimeout(t);
  }, [done, pinned]);

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderRelease: (_, g) => { if (g.dy > 40) close(); },
  })).current;

  const onBubble = () => {
    if (!done) setTyped(beat.text.length); // tap to complete instantly
    else setPinned(p => !p);               // then tap pins it open
  };

  const slide = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: enter.value * (PORTRAIT_H + 60) }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  const text = beat.text.slice(0, typed);
  const color = ch?.bubbleColor ?? world.aura;

  if (isSystem) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents={passThrough ? 'box-none' : 'auto'}>
        {!passThrough && <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss" />}
        <View style={styles.systemWrap} pointerEvents="box-none">
          <Animated.View style={[styles.system, { borderColor: world.auraAlt, shadowColor: world.auraAlt }, slide]} {...pan.panHandlers}>
            <Pressable onPress={onBubble} accessibilityRole="text">
              <AppText variant="label" color={world.auraAlt} style={styles.systemTitle}>[ SYSTEM ]</AppText>
              <AppText variant="heading" style={styles.systemText}>{text}</AppText>
              {pinned && <AppText variant="caption" style={styles.pin}>Pinned · swipe down to close</AppText>}
            </Pressable>
          </Animated.View>
        </View>
      </View>
    );
  }

  const images = CHARACTERS[beat.speaker as CharacterId];
  const src = beat.hype && images.hype ? images.hype : images.portrait;
  const bubbleMax = Math.min(280, width - PORTRAIT_W - Spacing.xl * 2);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={passThrough ? 'box-none' : 'auto'}>
      {!passThrough && <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss" />}
      <Animated.View
        style={[styles.anchor, { bottom: TAB_BAR + Math.max(0, insets.bottom - 20) }, slide]}
        pointerEvents="box-none"
        {...pan.panHandlers}
      >
        <Pressable onPress={onBubble} style={[styles.bubbleWrap, { maxWidth: bubbleMax }]} accessibilityRole="text" accessibilityLabel={`${ch!.name}: ${beat.text}`}>
          <Bubble shout={beat.hype}>
            <AppText style={[styles.name, { color }]}>{ch!.name}</AppText>
            <AppText variant="heading" color={Colors.ink}>{text}</AppText>
            {pinned && <AppText variant="caption" color={Colors.textMuted} style={styles.pin}>Pinned · swipe down to close</AppText>}
          </Bubble>
        </Pressable>
        <Pressable onPress={close} style={styles.portrait} accessibilityLabel={`Dismiss ${ch!.name}`}>
          {beat.hype && !reduce && (
            <Animated.View style={[StyleSheet.absoluteFill, styles.hypeBg, { backgroundColor: color + '55' }, flashStyle]}>
              <SpeedLines color={color} count={36} opacity={0.9} hole={0.2} />
            </Animated.View>
          )}
          <Image source={src} style={styles.img} contentFit="contain" contentPosition="bottom" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** White manga bubble, 2px ink border. `shout` = jagged burst outline. */
function Bubble({ shout, children }: { shout: boolean; children: ReactNode }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };
  if (!shout) return <View style={styles.bubble}>{children}</View>;

  // Jagged outline: alternate points along each edge, pushed out by 6px.
  const { w, h } = size;
  const pts: string[] = [];
  const spikes = (x1: number, y1: number, x2: number, y2: number, nx: number, ny: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const out = i % 2 ? 6 : 0;
      pts.push(`${x1 + (x2 - x1) * t + nx * out},${y1 + (y2 - y1) * t + ny * out}`);
    }
  };
  if (w > 0) {
    const nx = Math.max(4, Math.round(w / 24)) * 2;
    const ny = Math.max(2, Math.round(h / 24)) * 2;
    spikes(6, 6, w - 6, 6, 0, -1, nx);
    spikes(w - 6, 6, w - 6, h - 6, 1, 0, ny);
    spikes(w - 6, h - 6, 6, h - 6, 0, 1, nx);
    spikes(6, h - 6, 6, 6, -1, 0, ny);
  }
  return (
    <View style={styles.shout} onLayout={onLayout}>
      {w > 0 && (
        <Svg style={StyleSheet.absoluteFill} width={w} height={h} pointerEvents="none">
          <Polygon points={pts.join(' ')} fill={Colors.paper} stroke={Colors.ink} strokeWidth={2.5} strokeLinejoin="round" />
        </Svg>
      )}
      {children}
    </View>
  );
}

/** After a world change: "New cast unlocked" with the new world's six portraits. */
function CastUnlock({ tier, onDone }: { tier: keyof typeof WORLDS; onDone: () => void }) {
  const world = WORLDS[tier];
  const rank = RANK_TIERS.find(t => t.key === tier)!;
  const fade = useSharedValue(0);
  useEffect(() => { fade.value = withTiming(1, { duration: 260 }); }, []);
  const style = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ scale: 0.96 + fade.value * 0.04 }] }));
  return (
    <Pressable style={[StyleSheet.absoluteFill, styles.unlockBackdrop]} onPress={onDone} accessibilityLabel="Close">
      <Animated.View style={[styles.unlock, { borderColor: world.aura }, style]}>
        <AppText variant="title" color={world.aura}>New cast unlocked</AppText>
        <AppText variant="label">{rank.label} · {world.series}</AppText>
        <View style={styles.grid}>
          {WORLD_CAST[tier].map(id => (
            <View key={id} style={styles.cell}>
              <Image source={CHARACTERS[id].portrait} style={styles.cellImg} contentFit="contain" />
              <AppText variant="caption" color={Colors.text} numberOfLines={1}>{CHARACTERS[id].name}</AppText>
            </View>
          ))}
        </View>
        <AppText variant="caption">Tap to continue</AppText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', right: 0, flexDirection: 'row', alignItems: 'flex-end' },
  bubbleWrap: { marginRight: -Spacing.sm, marginBottom: PORTRAIT_H * 0.45 },
  bubble: {
    backgroundColor: Colors.paper,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.md,
    gap: 2,
  },
  shout: { paddingHorizontal: Spacing.lg + 2, paddingVertical: Spacing.lg, gap: 2 },
  name: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 20 },
  pin: { marginTop: 4 },
  portrait: { width: PORTRAIT_W, height: PORTRAIT_H, overflow: 'hidden' },
  hypeBg: { overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  systemWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  system: {
    alignSelf: 'stretch',
    borderWidth: 1.5,
    backgroundColor: Colors.bg + 'F2',
    padding: Spacing.lg,
    gap: Spacing.sm,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  systemTitle: { fontFamily: Fonts.hudBold, letterSpacing: 3, textAlign: 'center' },
  systemText: { textAlign: 'center' },
  unlockBackdrop: { backgroundColor: Colors.ink + 'CC', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  unlock: { alignSelf: 'stretch', backgroundColor: Colors.surface, borderWidth: 2, padding: Spacing.xl, gap: Spacing.md, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.md },
  cell: { width: 84, alignItems: 'center', gap: 4 },
  cellImg: { width: 72, height: 96 },
});
