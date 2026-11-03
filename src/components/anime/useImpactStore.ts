import { create } from 'zustand';

interface ImpactState {
  /** Increments per hit so the overlay can re-trigger on identical calls */
  seq: number;
  color: string | null;
  sfx: string | null;
  /** Fire an impact frame: 120ms inverted flash + heavy haptic. */
  fire: (color: string, sfx?: string) => void;
}

export const useImpactStore = create<ImpactState>(set => ({
  seq: 0,
  color: null,
  sfx: null,
  fire: (color, sfx) => set(s => ({ seq: s.seq + 1, color, sfx: sfx ?? null })),
}));

/** Imperative helper for non-React call sites. */
export const fireImpact = (color: string, sfx?: string) => useImpactStore.getState().fire(color, sfx);
