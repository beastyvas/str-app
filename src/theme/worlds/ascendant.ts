import { WORLD_CAST } from '@/constants/cast';
import { WORLD_COLORS } from './palette';
import { TalismanMotif } from './motifs/TalismanMotif';
import type { WorldTheme } from './types';

export const ascendantWorld: WorldTheme = {
  key: 'ascendant',
  series: 'Jujutsu Kaisen',
  ...WORLD_COLORS.ascendant,
  Motif: TalismanMotif,
  panel: { cutCorner: 10, borderWidth: 2 },
  sfx: { pr: 'ドン', rankUp: 'ゴオオ', summary: 'ズン', menace: 'ゴゴゴ' },
  powerReadout: 'seal',
  rankUpScene: 'domainExpand',
  roster: WORLD_CAST.ascendant,
};
