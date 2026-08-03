// Design tokens for the Iron & Brass system. colors.ts stays the single
// source of color truth (6-digit hex — call sites concat alpha suffixes);
// this file layers spacing, radii, type, elevation, and gradients on top.
import { TextStyle } from 'react-native';
import { Colors } from './colors';

export { Colors } from './colors';
export type { TierName } from './colors';

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  /** Standard horizontal screen padding */
  screenH: 20,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
} as const;

// Codifies the app's existing voice: heavy weights, tight negative tracking
// on display text, wide-tracked uppercase overlines, tabular numerals on
// anything that counts. Spread into style arrays: [Type.title, { ... }].
export const Type = {
  display: { fontSize: 32, fontWeight: '800', letterSpacing: -1.5, lineHeight: 36, color: Colors.text },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, color: Colors.text },
  heading: { fontSize: 16, fontWeight: '800', letterSpacing: -0.4, color: Colors.text },
  body: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  micro: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase', color: Colors.textMuted },
  statValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'], color: Colors.text },
  mono: { fontVariant: ['tabular-nums'] },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof Type;

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  }),
} as const;

// Brass gradients (expo-linear-gradient). brassSheen/tierWash use hex-alpha
// suffixes per the colors.ts convention.
export const Gradients = {
  /** Primary CTA fill */
  brass: ['#E3B341', '#C08A2E'] as const,
  /** Subtle top-wash for hero cards */
  brassSheen: [Colors.accent + '20', Colors.accent + '00'] as const,
  /** Surface depth for large cards */
  surface: [Colors.surface2, Colors.surface] as const,
  /** Tier-colored hero wash — pass rankResult.tier.color */
  tierWash: (color: string) => [color + '1F', color + '00'] as const,
} as const;
