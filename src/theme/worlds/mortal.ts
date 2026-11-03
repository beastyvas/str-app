import { WORLD_CAST } from '@/constants/cast';
import { WORLD_COLORS } from './palette';
import { SeigaihaMotif } from './motifs/SeigaihaMotif';
import type { WorldTheme } from './types';

export const mortalWorld: WorldTheme = {
  key: 'mortal',
  series: 'Demon Slayer',
  ...WORLD_COLORS.mortal,
  Motif: SeigaihaMotif,
  panel: { cutCorner: 8, borderWidth: 2 },
  sfx: { pr: 'ドン', rankUp: 'ザン', summary: 'ズン', menace: 'ゴゴゴ' },
  powerReadout: 'brush',
  rankUpScene: 'inkStroke',
  roster: WORLD_CAST.mortal,
};
