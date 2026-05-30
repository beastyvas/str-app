import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface LoggedSet {
  id?: string;               // undefined until saved to DB
  localId: string;           // temp local key
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rpe?: number;
  note?: string;
  loggedAt: string;
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
  removeExercise: (exerciseId: string) => void;
  logSet: (
    exerciseId: string,
    set: { weight: number; reps: number; rpe?: number; note?: string },
    workoutId: string,
    userId: string
  ) => Promise<{ isPR: boolean }>;
  updateSet: (exerciseId: string, localId: string, updates: Partial<LoggedSet>) => void;
  deleteSet: (exerciseId: string, localId: string) => void;
  finishWorkout: (notes?: string) => Promise<any>;
  discardWorkout: () => Promise<void>;
  clearPRs: () => void;
}

let localIdCounter = 0;
const newLocalId = () => `local_${Date.now()}_${localIdCounter++}`;

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
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
      })
      .select()
      .single();

    if (error) throw error;

    // Check PR — estimate 1RM using Epley formula: w * (1 + r/30)
    const oneRM = setData.weight * (1 + setData.reps / 30);
    const { data: existingPR } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId)
      .single();

    let isPR = false;
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
    const { activeWorkout } = get();
    if (activeWorkout?.id) {
      await supabase.from('workouts').delete().eq('id', activeWorkout.id);
    }
    set({ activeWorkout: null, lastSetLoggedAt: null, newPRs: [] });
  },

  clearPRs: () => set({ newPRs: [] }),
}));
