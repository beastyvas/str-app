// World colors. `aura` mirrors RANK_TIERS[].color; `auraAlt` is the world's
// secondary accent. The only place world hex lives besides ranks.ts.
import type { TierKey } from '@/constants/cast';

export const WORLD_COLORS: Record<TierKey, { aura: string; auraAlt: string }> = {
  mortal: { aura: '#F97316', auraAlt: '#14B8A6' },
  awakened: { aura: '#EF4444', auraAlt: '#FACC15' },
  ascendant: { aura: '#818CF8', auraAlt: '#E879F9' },
  phantom: { aura: '#38BDF8', auraAlt: '#F59E0B' },
  sovereign: { aura: '#A78BFA', auraAlt: '#60A5FA' },
  godhand: { aura: '#FBBF24', auraAlt: '#EF4444' },
};
