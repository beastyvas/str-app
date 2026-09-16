import { create } from 'zustand';

/**
 * Uncommitted set input, mirrored out of the open <SetInputRow /> so the finish
 * flow can see it.
 *
 * Why this exists: weight/reps live in the input row's own useState and reach
 * the workout store only when the ✓ is tapped. The row also keeps its values
 * after a log (deliberately — the next straight set is usually the same load),
 * so a typed-but-unlogged row looks almost exactly like a logged one. Tapping
 * FINISH at that point discarded the input with no warning, because the finish
 * check counted store sets only.
 *
 * Deliberately NOT part of useWorkout: this must stay out of the persisted
 * activeWorkout blob, and useWorkout is load-bearing.
 *
 * IMPORTANT: read this with `useSetDrafts.getState()`, never by subscribing.
 * It is written on every keystroke; a subscribed component would re-render the
 * workout screen on each one, which is exactly what ElapsedTime and the memo'd
 * ExerciseCards exist to avoid.
 */
export interface SetDraft {
  exerciseId: string;
  exerciseName: string;
  /** Canonical lbs, as it would be stored. */
  weight: number;
  reps: number;
  rpe?: number;
  note?: string;
  isWarmup: boolean;
  /** Mirrors the row's own canLog() — only these are worth offering to log. */
  canLog: boolean;
}

interface SetDraftStore {
  drafts: Record<string, SetDraft>;
  setDraft: (draft: SetDraft) => void;
  clearDraft: (exerciseId: string) => void;
  clearAll: () => void;
}

export const useSetDrafts = create<SetDraftStore>((set) => ({
  drafts: {},

  setDraft: (draft) =>
    set(state => ({ drafts: { ...state.drafts, [draft.exerciseId]: draft } })),

  clearDraft: (exerciseId) =>
    set(state => {
      if (!state.drafts[exerciseId]) return state;
      const { [exerciseId]: _removed, ...rest } = state.drafts;
      return { drafts: rest };
    }),

  clearAll: () => set({ drafts: {} }),
}));

/** Every draft that holds a set worth offering to log. */
export function pendingDrafts(): SetDraft[] {
  return Object.values(useSetDrafts.getState().drafts).filter(d => d.canLog);
}
