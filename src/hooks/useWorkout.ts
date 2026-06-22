import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export interface LoggedSet {
  id?: string;
  localId: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rpe?: number;
  note?: string;
  loggedAt: string;
  isWarmup?: boolean;
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  equipmentType?: string;
  sets: LoggedSet[];
}

export interface ActiveWorkout {
  id?: string;               // set after DB insert
  name: string;
  startedAt: Date;
  exercises: WorkoutExercise[];
}

interface WorkoutStore {
  activeWorkout: ActiveWorkout | null;
  lastSetLoggedAt: Date | null;       // drives rest timer
  newPRs: { exerciseName: string; weight: number; reps: number }[];

  startWorkout: (name: string, userId: string) => Promise<void>;
  addExercise: (exercise: { id: string; name: string; muscle_group: string; equipment_type?: string }) => void;
  replaceExercise: (
    oldExerciseId: string,
    exercise: { id: string; name: string; muscle_group: string; equipment_type?: string }
  ) => Promise<void>;
  removeExercise: (exerciseId: string) => void;
  logSet: (
    exerciseId: string,
    set: { weight: number; reps: number; rpe?: number; note?: string; isWarmup?: boolean },
    workoutId: string,
    userId: string
  ) => Promise<{ isPR: boolean }>;
  updateSet: (exerciseId: string, localId: string, updates: Partial<LoggedSet>) => void;
  deleteSet: (exerciseId: string, localId: string) => void;
  finishWorkout: (notes?: string) => Promise<any>;
  discardWorkout: () => Promise<void>;
  clearPRs: () => void;
  restoreWorkout: (userId: string) => Promise<boolean>;
}

let localIdCounter = 0;
const newLocalId = () => `local_${Date.now()}_${localIdCounter++}`;

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
  activeWorkout: null,
  lastSetLoggedAt: null,
  newPRs: [],

  startWorkout: async (name, userId) => {
    const { data, error } = await supabase
      .from('workouts')
      .insert({ user_id: userId, name, started_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;

    set({
      activeWorkout: {
        id: data.id,
        name: data.name,
        startedAt: new Date(data.started_at),
        exercises: [],
      },
      lastSetLoggedAt: null,
      newPRs: [],
    });
  },

  addExercise: (exercise) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    // Don't add duplicate
    if (activeWorkout.exercises.find(e => e.exerciseId === exercise.id)) return;
    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: [
          ...activeWorkout.exercises,
          { exerciseId: exercise.id, exerciseName: exercise.name, muscleGroup: exercise.muscle_group, equipmentType: exercise.equipment_type, sets: [] },
        ],
      },
    });
  },

  replaceExercise: async (oldExerciseId, exercise) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    if (activeWorkout.exercises.find(e => e.exerciseId === exercise.id)) return;

    // Re-point any sets already logged for the old exercise so they stay
    // attached to the swapped-in one instead of vanishing from the workout.
    if (activeWorkout.id) {
      await supabase
        .from('workout_sets')
        .update({ exercise_id: exercise.id })
        .eq('workout_id', activeWorkout.id)
        .eq('exercise_id', oldExerciseId);
    }

    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: activeWorkout.exercises.map(e =>
          e.exerciseId === oldExerciseId
            ? {
                ...e,
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                muscleGroup: exercise.muscle_group,
                equipmentType: exercise.equipment_type,
                sets: e.sets.map(s => ({ ...s, exerciseId: exercise.id })),
              }
            : e
        ),
      },
    });
  },

  removeExercise: (exerciseId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: activeWorkout.exercises.filter(e => e.exerciseId !== exerciseId),
      },
    });
  },

  logSet: async (exerciseId, setData, workoutId, userId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return { isPR: false };

    const ex = activeWorkout.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) return { isPR: false };

    const setNumber = ex.sets.length + 1;
    const localId = newLocalId();
    const loggedAt = new Date().toISOString();

    // Save to DB
    const { data: savedSet, error } = await supabase
      .from('workout_sets')
      .insert({
        workout_id: workoutId,
        exercise_id: exerciseId,
        set_number: setNumber,
        weight: setData.weight,
        reps: setData.reps,
        rpe: setData.rpe ?? null,
        note: setData.note ?? null,
        logged_at: loggedAt,
        is_warmup: setData.isWarmup ?? false,
      })
      .select()
      .single();

    if (error) throw error;

    // Warmup sets never count as PRs
    if (setData.isWarmup) {
      const newSet: LoggedSet = {
        id: savedSet.id, localId, exerciseId, setNumber,
        weight: setData.weight, reps: setData.reps,
        rpe: setData.rpe, note: setData.note, loggedAt,
        isWarmup: true,
      };
      set(state => ({
        lastSetLoggedAt: new Date(),
        activeWorkout: state.activeWorkout ? {
          ...state.activeWorkout,
          exercises: state.activeWorkout.exercises.map(e =>
            e.exerciseId === exerciseId ? { ...e, sets: [...e.sets, newSet] } : e
          ),
        } : null,
      }));
      return { isPR: false };
    }

    // Check PR — estimate 1RM using Epley formula: w * (1 + r/30)
    const oneRM = setData.weight * (1 + setData.reps / 30);
    // maybeSingle — zero rows (no PR yet) is a valid, non-error result here.
    // Using .single() previously meant ANY fetch error (not just "no rows")
    // fell through the same `: 0` branch below, silently treating every set
    // as beating a "0" PR and marking it a personal record every time.
    const { data: existingPR, error: prFetchError } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId)
      .maybeSingle();

    let isPR = false;
    if (prFetchError) {
      console.warn('[logSet] could not fetch existing PR, skipping PR check:', prFetchError.message);
    } else {
      const existingOneRM = existingPR
        ? existingPR.weight * (1 + existingPR.reps / 30)
        : 0;

      if (oneRM > existingOneRM) {
        isPR = true;
        await supabase
          .from('personal_records')
          .upsert({
            user_id: userId,
            exercise_id: exerciseId,
            weight: setData.weight,
            reps: setData.reps,
            achieved_at: loggedAt,
          }, { onConflict: 'user_id,exercise_id' });

        set(state => ({
          newPRs: [
            ...state.newPRs,
            { exerciseName: ex.exerciseName, weight: setData.weight, reps: setData.reps },
          ],
        }));
      }
    }

    const newSet: LoggedSet = {
      id: savedSet.id,
      localId,
      exerciseId,
      setNumber,
      weight: setData.weight,
      reps: setData.reps,
      rpe: setData.rpe,
      note: setData.note,
      loggedAt,
    };

    set(state => ({
      lastSetLoggedAt: new Date(),
      activeWorkout: state.activeWorkout
        ? {
            ...state.activeWorkout,
            exercises: state.activeWorkout.exercises.map(e =>
              e.exerciseId === exerciseId ? { ...e, sets: [...e.sets, newSet] } : e
            ),
          }
        : null,
    }));

    return { isPR };
  },

  updateSet: (exerciseId, localId, updates) => {
    set(state => ({
      activeWorkout: state.activeWorkout
        ? {
            ...state.activeWorkout,
            exercises: state.activeWorkout.exercises.map(e =>
              e.exerciseId === exerciseId
                ? { ...e, sets: e.sets.map(s => s.localId === localId ? { ...s, ...updates } : s) }
                : e
            ),
          }
        : null,
    }));
  },

  deleteSet: (exerciseId, localId) => {
    set(state => ({
      activeWorkout: state.activeWorkout
        ? {
            ...state.activeWorkout,
            exercises: state.activeWorkout.exercises.map(e =>
              e.exerciseId === exerciseId
                ? { ...e, sets: e.sets.filter(s => s.localId !== localId).map((s, i) => ({ ...s, setNumber: i + 1 })) }
                : e
            ),
          }
        : null,
    }));
  },

  finishWorkout: async (notes) => {
    const { activeWorkout } = get();
    if (!activeWorkout?.id) throw new Error('No active workout');

    const endedAt = new Date().toISOString();
    await supabase
      .from('workouts')
      .update({ ended_at: endedAt, notes: notes ?? null })
      .eq('id', activeWorkout.id);

    const allSets = activeWorkout.exercises.flatMap(e => e.sets);
    const totalVolume = allSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    const durationSeconds = Math.round((Date.now() - activeWorkout.startedAt.getTime()) / 1000);

    const summary = {
      workoutId: activeWorkout.id,
      name: activeWorkout.name,
      duration: durationSeconds,
      totalSets: allSets.length,
      totalVolume,
      prs: get().newPRs,
      exercises: activeWorkout.exercises.map(e => ({
        name: e.exerciseName,
        sets: e.sets.sort((a, b) => b.weight - a.weight),
      })),
    };

    set({ activeWorkout: null, lastSetLoggedAt: null, newPRs: [] });
    return summary;
  },

  discardWorkout: async () => {
    const { activeWorkout, newPRs } = get();
    if (activeWorkout?.id) {
      // Delete the workout (cascades to workout_sets via FK)
      await supabase.from('workouts').delete().eq('id', activeWorkout.id);

      // Roll back any PRs that were set during this workout
      if (newPRs.length > 0) {
        for (const pr of newPRs) {
          // Get the exercise ID
          const { data: ex } = await supabase
            .from('exercises').select('id').eq('name', pr.exerciseName).single();
          if (!ex) continue;

          // Find the previous PR for this exercise (before this workout)
          // by looking at workout_sets not in this workout
          const { data: prevSets } = await supabase
            .from('workout_sets')
            .select('weight, reps')
            .eq('exercise_id', ex.id)
            .neq('workout_id', activeWorkout.id)
            .order('logged_at', { ascending: false })
            .limit(10);

          if (prevSets && prevSets.length > 0) {
            // Find best e1RM from previous sets
            const best = prevSets.reduce((b: any, s: any) => {
              const e1rm = s.weight * (1 + s.reps / 30);
              return e1rm > b.weight * (1 + b.reps / 30) ? s : b;
            }, prevSets[0]);
            // Restore previous PR
            await supabase.from('personal_records').upsert({
              exercise_id: ex.id,
              weight: best.weight,
              reps: best.reps,
              achieved_at: new Date().toISOString(),
            }, { onConflict: 'user_id,exercise_id' });
          } else {
            // No previous sets — delete the PR entirely
            await supabase.from('personal_records')
              .delete()
              .eq('exercise_id', ex.id);
          }
        }
      }
    }
    set({ activeWorkout: null, lastSetLoggedAt: null, newPRs: [] });
  },

  clearPRs: () => set({ newPRs: [] }),

  restoreWorkout: async (userId) => {
    // If persist already restored an active workout, nothing to do
    if (get().activeWorkout) return true;

    // Check Supabase for an incomplete workout (ended_at is null)
    const { data: workout } = await supabase
      .from('workouts')
      .select('id, name, started_at, workout_sets(id, exercise_id, set_number, weight, reps, rpe, note, logged_at, exercises(id, name, muscle_group, equipment_type))')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!workout) return false;

    // Rebuild exercises + sets from DB
    const exerciseMap: Record<string, WorkoutExercise> = {};
    for (const s of (workout.workout_sets ?? []) as any[]) {
      const ex = s.exercises;
      if (!ex) continue;
      if (!exerciseMap[ex.id]) {
        exerciseMap[ex.id] = { exerciseId: ex.id, exerciseName: ex.name, muscleGroup: ex.muscle_group, equipmentType: ex.equipment_type, sets: [] };
      }
      exerciseMap[ex.id].sets.push({
        id: s.id, localId: `restored_${s.id}`,
        exerciseId: ex.id, setNumber: s.set_number,
        weight: s.weight, reps: s.reps,
        rpe: s.rpe, note: s.note, loggedAt: s.logged_at,
      });
    }

    // Sort sets within each exercise
    Object.values(exerciseMap).forEach(e => e.sets.sort((a, b) => a.setNumber - b.setNumber));

    set({
      activeWorkout: {
        id: workout.id,
        name: workout.name,
        startedAt: new Date(workout.started_at),
        exercises: Object.values(exerciseMap),
      },
      lastSetLoggedAt: null,
    });
    return true;
  },
    }),
    {
      name: 'str-active-workout',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the active workout and last set time — not transient PR banners
      partialize: (state) => ({
        activeWorkout: state.activeWorkout,
        lastSetLoggedAt: state.lastSetLoggedAt,
      }),
      // Dates come back from JSON as strings — convert them back
      onRehydrateStorage: () => (state) => {
        if (state?.activeWorkout?.startedAt) {
          state.activeWorkout.startedAt = new Date(state.activeWorkout.startedAt);
        }
        if (state?.lastSetLoggedAt) {
          state.lastSetLoggedAt = new Date(state.lastSetLoggedAt);
        }
      },
    }
  )
);
