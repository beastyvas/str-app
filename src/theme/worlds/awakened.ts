import { WORLD_CAST } from '@/constants/cast';
import { WORLD_COLORS } from './palette';
import { HalftoneMotif } from './motifs/HalftoneMotif';
import type { WorldTheme } from './types';

export const awakenedWorld: WorldTheme = {
  key: 'awakened',
  series: 'My Hero Academia',
  ...WORLD_COLORS.awakened,
  Motif: HalftoneMotif,
  panel: { cutCorner: 14, borderWidth: 2 },
  sfx: { pr: 'ドカン', rankUp: 'バーン', summary: 'ズン', menace: 'ゴゴゴ' },
  powerReadout: 'comic',
  rankUpScene: 'comicBurst',
  roster: WORLD_CAST.awakened,
};
