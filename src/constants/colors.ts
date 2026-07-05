// Iron & Brass — warm graphite ground, bone text, single brass accent.
// All color tokens MUST stay 6-digit hex: call sites concat alpha suffixes
// (e.g. Colors.accent + '40'), which breaks on rgba() strings.
export const Colors = {
  bg: '#101012',
  surface: '#1A191C',
  surface2: '#232125',
  surface3: '#2B292E',
  border: '#26242A',
  borderLight: '#37343C',

  text: '#F4F1EC',
  textSecondary: '#A09B93',
  textMuted: '#6D6862',

  accent: '#D9A441',
  accentDim: 'rgba(217, 164, 65, 0.12)',

  gold: '#E3B341',
  goldDim: 'rgba(227, 179, 65, 0.12)',

  success: '#22C55E',
  successDim: 'rgba(34, 197, 94, 0.12)',

  danger: '#EF4444',
  dangerDim: 'rgba(239, 68, 68, 0.12)',

  // Strength tier colors
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
