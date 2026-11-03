import { WORLD_CAST } from '@/constants/cast';
import { WORLD_COLORS } from './palette';
import { SystemWindowMotif } from './motifs/SystemWindowMotif';
import type { WorldTheme } from './types';

export const sovereignWorld: WorldTheme = {
  key: 'sovereign',
  series: 'Solo Leveling',
  ...WORLD_COLORS.sovereign,
  Motif: SystemWindowMotif,
  panel: { cutCorner: 10, borderWidth: 2 },
  sfx: { pr: 'ドン', rankUp: 'ピコン', summary: 'ズン', menace: 'ゴゴゴ' },
  powerReadout: 'system',
  rankUpScene: 'systemLevelUp',
  roster: WORLD_CAST.sovereign,
};
