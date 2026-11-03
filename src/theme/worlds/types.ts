import type { FC } from 'react';
import type { CharacterId, TierKey } from '@/constants/cast';

export type MotifIntensity = 'header' | 'hero' | 'full';

export interface MotifProps {
  intensity: MotifIntensity;
  /** Slow idle drift — only the Home hero should pass this */
  animated?: boolean;
}

export type PowerReadoutStyle = 'brush' | 'comic' | 'seal' | 'scouter' | 'system' | 'plain';
export type RankUpSceneStyle = 'inkStroke' | 'comicBurst' | 'domainExpand' | 'auraFlare' | 'systemLevelUp' | 'onePunch';

export interface WorldTheme {
  key: TierKey;
  /** For my own reference in settings */
  series: string;
  /** Existing RANK_TIERS color */
  aura: string;
  /** Secondary accent for that world */
  auraAlt: string;
  /** SVG pattern layer, absolutely fills its parent, never takes touches */
  Motif: FC<MotifProps>;
  panel: { cutCorner: number; borderWidth: number };
  sfx: { pr: string; rankUp: string; summary: string; menace: string };
  powerReadout: PowerReadoutStyle;
  rankUpScene: RankUpSceneStyle;
  roster: readonly CharacterId[];
}

/** Motif layer opacity per intensity. Kept low so motifs frame, never compete. */
export const MOTIF_OPACITY: Record<MotifIntensity, number> = {
  header: 0.14,
  hero: 0.1,
  full: 0.07,
};
