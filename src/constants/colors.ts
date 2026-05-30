export const Colors = {
  bg: '#0C0C0C',
  surface: '#161616',
  surface2: '#1E1E1E',
  surface3: '#252525',
  border: '#2A2A2A',
  borderLight: '#383838',

  text: '#FFFFFF',
  textSecondary: '#888888',
  textMuted: '#555555',

  accent: '#D4197A',
  accentDim: 'rgba(212, 25, 122, 0.12)',

  gold: '#FFB800',
  goldDim: 'rgba(255, 184, 0, 0.12)',

  success: '#22C55E',
  successDim: 'rgba(34, 197, 94, 0.12)',

  danger: '#EF4444',
  dangerDim: 'rgba(239, 68, 68, 0.12)',

  // Strength tier colors
  tiers: {
    beginner: '#555555',
    bronze: '#CD7F32',
    silver: '#A8A9AD',
    gold: '#FFB800',
    platinum: '#E5E4E2',
    diamond: '#B9F2FF',
  },
} as const;

export type TierName = 'beginner' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
