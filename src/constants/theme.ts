// Design tokens for the anime world system. colors.ts stays the single
// source of base color truth (6-digit hex — call sites concat alpha
// suffixes); world auras come from `useWorld()`. This file layers spacing,
// radii, type and the font families on top.
import { TextStyle } from 'react-native';
import { Colors } from './colors';

export { Colors } from './colors';
export type { TierName } from './colors';

// 8-pt grid. 20 screen padding, 28 between groups.
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  /** Standard horizontal screen padding */
  screenH: 20,
  /** Gap between groups on a screen */
  group: 28,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  /** Rows, inputs, buttons — plain rectangles with a 14 radius */
  lg: 14,
  xl: 18,
  pill: 999,
} as const;

/** Minimum tap targets */
export const Hit = {
  min: 44,
  /** Set-logging controls */
  log: 56,
} as const;

// Custom fonts on RN need one family name per weight — never pair these
// with fontWeight. Names match the keys loaded in app/_layout.tsx.
export const Fonts = {
  display: 'DelaGothicOne',
  hud: 'ChakraPetch-SemiBold',
  hudBold: 'ChakraPetch-Bold',
  body: 'Barlow-Regular',
  bodyMedium: 'Barlow-Medium',
  bodySemi: 'Barlow-SemiBold',
} as const;

// Sentence case everywhere. Uppercase is reserved for rank names and the
// Solo Leveling `[ SYSTEM ]` windows. There is deliberately no `overline`.
export const Type = {
  /** Power Level only */
  power: { fontFamily: Fonts.hudBold, fontSize: 64, lineHeight: 64, fontVariant: ['tabular-nums'], color: Colors.text },
  /** Screen titles, rank reveal */
  display: { fontFamily: Fonts.display, fontSize: 32, lineHeight: 38, color: Colors.text },
  /** Section headings */
  title: { fontFamily: Fonts.display, fontSize: 22, lineHeight: 28, color: Colors.text },
  /** Onomatopoeia layer — SfxLayer sets size/rotation/opacity */
  sfx: { fontFamily: Fonts.display, fontSize: 96, lineHeight: 110, color: Colors.text },
  /** Row titles, speech bubble lines */
  heading: { fontFamily: Fonts.bodySemi, fontSize: 17, lineHeight: 22, color: Colors.text },
  body: { fontFamily: Fonts.body, fontSize: 15, lineHeight: 22, color: Colors.textSecondary },
  /** Field labels — sentence case */
  label: { fontFamily: Fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
  caption: { fontFamily: Fonts.body, fontSize: 12, lineHeight: 16, color: Colors.textMuted },
  /** Weights, reps, volume, timers */
  stat: { fontFamily: Fonts.hud, fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'], color: Colors.text },
  mono: { fontVariant: ['tabular-nums'] },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof Type;

// Manga panels have no drop shadows. Kept only for floating chrome
// (tab-bar button, cameo portrait) that genuinely sits above content.
export const Shadow = {
  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

/** Relative luminance (WCAG) of a #RRGGBB color */
export function luminance(hex: string): number {
  const h = hex.replace('#', '').slice(0, 6);
  const ch = [0, 2, 4].map(i => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Text color for content on a solid `fill`: Night or Ki, whichever contrasts more. */
export function onColor(fill: string): string {
  const L = luminance(fill);
  const onNight = (L + 0.05) / (luminance(Colors.bg) + 0.05);
  const onKi = (luminance(Colors.text) + 0.05) / (L + 0.05);
  return onNight >= onKi ? Colors.bg : Colors.text;
}
