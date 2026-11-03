import { WORLD_CAST } from '@/constants/cast';
import { WORLD_COLORS } from './palette';
import { AuraFlameMotif } from './motifs/AuraFlameMotif';
import type { WorldTheme } from './types';

export const phantomWorld: WorldTheme = {
  key: 'phantom',
  series: 'Dragon Ball',
  ...WORLD_COLORS.phantom,
  Motif: AuraFlameMotif,
  panel: { cutCorner: 12, borderWidth: 2 },
  sfx: { pr: 'ドーン', rankUp: 'ゴオオオ', summary: 'ズン', menace: 'ゴゴゴ' },
  powerReadout: 'scouter',
  rankUpScene: 'auraFlare',
  roster: WORLD_CAST.phantom,
};
