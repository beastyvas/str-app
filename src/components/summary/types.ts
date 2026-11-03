import type { TierName } from '@/constants/colors';

export interface SummaryRank {
  key: string;
  sub: number;
  /** per-lift tier names, [squat, bench, deadlift] */
  lifts: TierName[];
}

/** Power Level before/after, passed from workout.tsx in the summary params. */
export interface SummaryPower {
  before: number | null;
  after: number | null;
  confidence: 'full' | 'partial' | 'calibrating';
  beforeRank: SummaryRank | null;
  afterRank: SummaryRank | null;
}
