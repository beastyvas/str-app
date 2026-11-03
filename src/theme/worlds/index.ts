import type { TierKey } from '@/constants/cast';
import { mortalWorld } from './mortal';
import { awakenedWorld } from './awakened';
import { ascendantWorld } from './ascendant';
import { phantomWorld } from './phantom';
import { sovereignWorld } from './sovereign';
import { godhandWorld } from './godhand';
import type { WorldTheme } from './types';

export * from './types';
export { WORLD_COLORS } from './palette';

export const WORLDS: Record<TierKey, WorldTheme> = {
  mortal: mortalWorld,
  awakened: awakenedWorld,
  ascendant: ascendantWorld,
  phantom: phantomWorld,
  sovereign: sovereignWorld,
  godhand: godhandWorld,
};

export const WORLD_LIST: WorldTheme[] = Object.values(WORLDS);
