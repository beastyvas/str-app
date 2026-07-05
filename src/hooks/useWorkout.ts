import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';

export interface LoggedSet {
  id?: string;
  // Client-generated UUID used as the DB primary key, so a retried insert
  // after a lost response is a duplicate-key no-op instead of a double log
  uuid?: string;
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
  // Two adjacent exercises sharing a supersetId alternate as a pair.
  // Session-local (persisted with the active workout, not written to DB).
  supersetId?: string;
  sets: LoggedSet[];
}

export interface ActiveWorkout {
  id?: string;               // set after DB insert — absent means the row is still queued (started offline)
  userId?: string;           // owner — needed to create the row later when started offline
  name: string;
  startedAt: Date;
  exercises: WorkoutExercise[];
}

interface WorkoutStore {
  activeWorkout: ActiveWorkout | null;
  lastSetLoggedAt: Date | null;       // drives rest timer
  lastSetWasWarmup: boolean;          // picks warmup vs working rest duration
  // True only after a sync attempt actually failed — the offline banner keys
  // off this, not off "something is in flight", so it never flashes on a
  // normal online log.
  syncFailed: boolean;
  newPRs: { exerciseName: string; weight: number; reps: number }[];

  startWorkout: (name: string, userId: string) => Promise<void>;
  addExercise: (exercise: { id: string; name: string; muscle_group: string; equipment_type?: string }) => void;
  replaceExercise: (
    oldExerciseId: string,
    exercise: { id: string; name: string; muscle_group: string; equipment_type?: string }
  ) => Promise<void>;
  removeExercise: (exerciseId: string) => void;
  // Pair this exercise with the NEXT one as a superset (or unpair if already
  // linked). Returns false when there's no valid partner.
  toggleSupersetWithNext: (exerciseId: string) => boolean;
  logSet: (
    exerciseId: string,
    set: { weight: number; reps: number; rpe?: number; note?: string; isWarmup?: boolean },
    workoutId: string | undefined,
    userId: string
  ) => Promise<{ isPR: boolean }>;
  // Pushes everything unsynced (workout row + sets without a DB id) to Supabase.
  // ok=false means still offline; prLocalIds are sets that turned out to be PRs.
  syncPending: () => Promise<{ ok: boolean; prLocalIds: string[] }>;
  updateSet: (exerciseId: string, localId: string, updates: Partial<LoggedSet>) => void;
  deleteSet: (exerciseId: string, localId: string) => void;
  finishWorkout: (notes?: string) => Promise<any>;
  discardWorkout: () => Promise<void>;
  clearPRs: () => void;
  restoreWorkout: (userId: string) => Promise<boolean>;
}

let localIdCounter = 0;
const newLocalId = () => `local_${Date.now()}_${localIdCounter++}`;

// Epley e1RM PR check + upsert. Returns whether this set beat the stored PR.
// Any fetch error skips the check — never falsely celebrate on flaky signal.
async function checkAndRecordPR(
  userId: string,
  exerciseId: string,
  weight: number,
  reps: number,
  loggedAt: string,
): Promise<boolean> {
  const oneRM = weight * (1 + reps / 30);
  const { data: existingPR, error } = await supabase
    .from('personal_records')
    .select('*')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .maybeSingle();
  if (error) {
    console.warn('[checkAndRecordPR] could not fetch existing PR, skipping:', error.message);
    return false;
  }
  const existingOneRM = existingPR ? existingPR.weight * (1 + existingPR.reps / 30) : 0;
  if (oneRM <= existingOneRM) return false;
  await supabase.from('personal_records').upsert({
    user_id: userId,
    exercise_id: exerciseId,
    weight,
    reps,
    achieved_at: loggedAt,
  }, { onConflict: 'user_id,exercise_id' });
  return true;
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
  activeWorkout: null,
  lastSetLoggedAt: null,
  lastSetWasWarmup: false,
  syncFailed: false,
  newPRs: [],

  startWorkout: async (name, userId) => {
    const startedAt = new Date();
    let id: string | undefined;
    try {
      const { data, error } = await supabase
        .from('workouts')
        .insert({ user_id: userId, name, started_at: startedAt.toISOString() })
        .select()
        .single();
      if (error) throw error;
      id = data.id;
    } catch {
      // Offline — the workout lives on this phone; syncPending() creates the
      // row (and everything logged into it) once there's a connection.
    }

    set({
      activeWorkout: { id, userId, name, startedAt, exercises: [] },
      lastSetLoggedAt: null,
      lastSetWasWarmup: false,
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
    // Removing one half of a superset dissolves the pair
    const removed = activeWorkout.exercises.find(e => e.exerciseId === exerciseId);
    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: activeWorkout.exercises
          .filter(e => e.exerciseId !== exerciseId)
          .map(e => removed?.supersetId && e.supersetId === removed.supersetId
            ? { ...e, supersetId: undefined }
            : e),
      },
    });
  },

  toggleSupersetWithNext: (exerciseId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return false;
    const i = activeWorkout.exercises.findIndex(e => e.exerciseId === exerciseId);
    const a = activeWorkout.exercises[i];
    const b = activeWorkout.exercises[i + 1];
    if (!a || !b) return false;

    const linked = !!a.supersetId && a.supersetId === b.supersetId;
    // v1 keeps supersets to clean pairs — bail if either is already paired elsewhere
    if (!linked && (a.supersetId || b.supersetId)) return false;

    const supersetId = linked ? undefined : `ss_${a.exerciseId.slice(0, 8)}`;
    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: activeWorkout.exercises.map((e, idx) =>
          idx === i || idx === i + 1 ? { ...e, supersetId } : e
        ),
      },
    });
    return true;
  },

  logSet: async (exerciseId, setData, _workoutId, _userId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return { isPR: false };

    const ex = activeWorkout.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) return { isPR: false };

    const setNumber = ex.sets.length + 1;
    const localId = newLocalId();
    const loggedAt = new Date().toISOString();

    // Offline-first: the set exists on this phone the moment it's logged.
    // No `id` marks it as queued; syncPending() below pushes it (and anything
    // older that's still queued) to Supabase and does the PR check there.
    const newSet: LoggedSet = {
      uuid: Crypto.randomUUID(),
      localId, exerciseId, setNumber,
      weight: setData.weight, reps: setData.reps,
      rpe: setData.rpe, note: setData.note, loggedAt,
      isWarmup: setData.isWarmup || undefined,
    };
    set(state => ({
      lastSetLoggedAt: new Date(),
      lastSetWasWarmup: !!setData.isWarmup,
      activeWorkout: state.activeWorkout ? {
        ...state.activeWorkout,
        exercises: state.activeWorkout.exercises.map(e =>
          e.exerciseId === exerciseId ? { ...e, sets: [...e.sets, newSet] } : e
        ),
      } : null,
    }));

    const { prLocalIds } = await get().syncPending();
    return { isPR: prLocalIds.includes(localId) };
  },

  syncPending: async () => {
    const aw = get().activeWorkout;
    if (!aw) return { ok: true, prLocalIds: [] };
    const prLocalIds: string[] = [];

    try {
      // 1. Create the workout row if the session started offline. Workouts
      //    persisted before userId existed fall back to the auth session.
      let workoutId = aw.id;
      if (!workoutId) {
        let userId = aw.userId;
        if (!userId) userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) return { ok: false, prLocalIds };
        const { data, error } = await supabase
          .from('workouts')
          .insert({ user_id: userId, name: aw.name, started_at: aw.startedAt.toISOString() })
          .select()
          .single();
        if (error) throw error;
        workoutId = data.id;
        set(state => ({
          activeWorkout: state.activeWorkout ? { ...state.activeWorkout, id: workoutId, userId } : null,
        }));
      }

      // 2. Push queued sets oldest-first so server order matches phone order
      const pending = (get().activeWorkout?.exercises ?? [])
        .flatMap(e => e.sets.filter(s => !s.id).map(s => ({ s, exerciseName: e.exerciseName })))
        .sort((a, b) => a.s.loggedAt.localeCompare(b.s.loggedAt));

      for (const { s, exerciseName } of pending) {
        const { data: saved, error } = await supabase
          .from('workout_sets')
          .insert({
            // Client UUID as the pk makes this insert idempotent (see LoggedSet.uuid)
            ...(s.uuid ? { id: s.uuid } : {}),
            workout_id: workoutId,
            exercise_id: s.exerciseId,
            set_number: s.setNumber,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe ?? null,
            note: s.note ?? null,
            logged_at: s.loggedAt,
            is_warmup: s.isWarmup ?? false,
          })
          .select()
          .single();
        // 23505 = duplicate key: this exact set already landed on a previous
        // attempt whose response we lost — treat as synced, don't re-insert.
        const alreadySynced = error?.code === '23505' && !!s.uuid;
        if (error && !alreadySynced) throw error;
        const rowId = alreadySynced ? s.uuid! : saved?.id;
        if (!rowId) throw new Error('insert returned no row');

        set(state => ({
          activeWorkout: state.activeWorkout ? {
            ...state.activeWorkout,
            exercises: state.activeWorkout.exercises.map(e =>
              e.exerciseId === s.exerciseId
                ? { ...e, sets: e.sets.map(x => x.localId === s.localId ? { ...x, id: rowId } : x) }
                : e
            ),
          } : null,
        }));

        // Warmup sets never count as PRs
        if (!s.isWarmup) {
          const uid = get().activeWorkout?.userId;
          const isPR = uid
            ? await checkAndRecordPR(uid, s.exerciseId, s.weight, s.reps, s.loggedAt)
            : false;
          if (isPR) {
            prLocalIds.push(s.localId);
            set(state => ({
              newPRs: [...state.newPRs, { exerciseName, weight: s.weight, reps: s.reps }],
            }));
          }
        }
      }
      set({ syncFailed: false });
      return { ok: true, prLocalIds };
    } catch {
      // Still offline — everything without a DB id stays queued on-device.
      set({ syncFailed: true });
      return { ok: false, prLocalIds };
    }
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
    // Everything must be on the server before the workout can close — a
    // finished workout with phone-only sets would silently lose them.
    const { ok } = await get().syncPending();
    const { activeWorkout } = get();
    if (!activeWorkout) throw new Error('No active workout');
    if (!ok || !activeWorkout.id) {
      throw new Error(
        "You're offline. Every set is saved on this phone — finish the workout once you're back online and nothing will be lost."
      );
    }

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
      // Need the owner id to correctly upsert/restore PRs (the conflict target
      // is user_id,exercise_id — without user_id the restore silently fails).
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id;

      // Delete the workout (cascades to workout_sets via FK)
      await supabase.from('workouts').delete().eq('id', activeWorkout.id);

      // Roll back any PRs that were set during this workout
      if (uid && newPRs.length > 0) {
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
              user_id: uid,
              exercise_id: ex.id,
              weight: best.weight,
              reps: best.reps,
              achieved_at: new Date().toISOString(),
            }, { onConflict: 'user_id,exercise_id' });
          } else {
            // No previous sets — delete the PR entirely
            await supabase.from('personal_records')
              .delete()
              .eq('user_id', uid)
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
    for (const s of ((workout as any).workout_sets ?? []) as any[]) {
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
        userId,
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
        lastSetWasWarmup: state.lastSetWasWarmup,
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
