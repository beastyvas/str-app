import { WORLD_CAST } from '@/constants/cast';
import { WORLD_COLORS } from './palette';
import { CalmMotif } from './motifs/CalmMotif';
import type { WorldTheme } from './types';

export const godhandWorld: WorldTheme = {
  key: 'godhand',
  series: 'One Punch Man',
  ...WORLD_COLORS.godhand,
  Motif: CalmMotif,
  panel: { cutCorner: 6, borderWidth: 2 },
  sfx: { pr: 'ドン', rankUp: 'ドン', summary: 'シーン', menace: 'ゴゴゴ' },
  powerReadout: 'plain',
  rankUpScene: 'onePunch',
  roster: WORLD_CAST.godhand,
};
