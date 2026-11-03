// Ink Night — the shared ground every anime world sits on. World colors
// (aura, auraAlt) live in src/theme/worlds/*, NOT here: real code reads
// `useWorld().aura`. `accent` is only a static fallback for places that run
// outside a WorldProvider.
//
// Base tokens MUST stay 6-digit hex: call sites concat alpha suffixes
// (e.g. Colors.accent + '40'), which breaks on rgba() strings. The *Dim
// tokens are pre-mixed 8-digit hex and must never be concatenated onto.
export const Colors = {
  bg: '#0C0E1A',
  surface: '#151829',
  surface2: '#1E2236',
  surface3: '#272C44',
  border: '#262B44',
  borderLight: '#343A58',

  text: '#EEF0FA',
  textSecondary: '#9096B4',
  textMuted: '#5D6283',

  /** Impact-frame silhouettes, comic borders */
  ink: '#000000',
  /** Impact-frame flash ground, speech bubbles */
  paper: '#FFFFFF',

  accent: '#F97316',
  accentDim: '#F973161F',

  gold: '#FBBF24',
  goldDim: '#FBBF241F',

  success: '#34D399',
  successDim: '#34D3991F',

  danger: '#F25555',
  dangerDim: '#F255551F',

  // Strength tier colors (legacy per-lift tiers — unchanged)
  tiers: {
    beginner: '#6D6862',
    bronze: '#CD7F32',
    silver: '#A8A9AD',
    gold: '#E3B341',
    platinum: '#E5E4E2',
    diamond: '#B9F2FF',
  },
} as const;

export type TierName = 'beginner' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
