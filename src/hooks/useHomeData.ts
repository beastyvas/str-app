import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { getRankResult, RankResult } from '@/constants/ranks';
import { classifySessionFromNames as classifySession } from '@/lib/sessionType';

export interface FriendPR {
  display_name: string;
  exercise_name: string;
  weight: number;
  reps: number;
  achieved_at: string;
  unit_pref?: 'lbs' | 'kg';
}

export interface LastWorkout {
  name: string;
  started_at: string;
  ended_at: string;
  sets_count: number;
  total_volume: number;
  exercises: string[];
}

export interface WorkoutDayData {
  sessionType: string;
  name: string;
  durationMins: number;
  topLifts: { name: string; weight: number; reps: number }[];
}

export interface FirstSteps {
  hasWorkout: boolean;
  hasFriend: boolean;
  hasCoach: boolean;
}

export interface Celebration {
  emoji: string;
  title: string;
  sub: string;
}

export interface HomeData {
  firstSteps: FirstSteps | null;
  creatorId: string | null;
  rankResult: RankResult | null;
  lastWorkout: LastWorkout | null;
  friendPRs: FriendPR[];
  recentFriendPost: {
    displayName: string;
    workoutName: string;
    notes?: string;
    exercises: string[];
    endedAt: string;
  } | null;
  workoutDays: Record<number, WorkoutDayData>;
}

// Module-level stale-while-revalidate cache: returning to the Home tab
// renders the last data instantly and refreshes silently in the background.
// The skeleton shows only on a true first load for this user.
let cache: { userId: string; data: HomeData } | null = null;

export function useHomeData() {
  const { user, profile } = useAuth();
  const [data, setData] = useState<HomeData | null>(
    cache && cache.userId === user?.id ? cache.data : null
  );
  const [loading, setLoading] = useState(data == null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const inFlight = useRef(false);

  const fetchData = useCallback(async () => {
    if (!user || inFlight.current) return;
    inFlight.current = true;
    try {
      const uid = user.id;
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;

      // This calendar week's range (Mon–Sun), for the weekly strip
      const now = new Date();
      const daysSinceMon = (now.getDay() + 6) % 7;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - daysSinceMon);
      weekStart.setHours(0, 0, 0, 0);

      // Wave 1 — everything independent, one round-trip batch (previously
      // two sequential Promise.all batches + a separate AsyncStorage batch).
      const [
        { count: workoutCount },
        { count: friendCount },
        weeklyPlanDone,
        { data: creator },
        workoutCelebrated,
        friendCelebrated,
        onboardingDone,
        planPending,
        prRes,
        workoutRes,
        friendRes,
        friendshipsRes,
        weekRes,
      ] = await Promise.all([
        supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', uid).not('ended_at', 'is', null),
        // Any friendship attempt (pending or accepted) marks this done
        supabase.from('friendships').select('id', { count: 'exact', head: true }).or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
        AsyncStorage.getItem(`weekly_plan_done_${uid}`),
        supabase.from('public_profiles').select('id').eq('is_owner', true).single(),
        AsyncStorage.getItem(`celebrated_workout_${uid}`),
        AsyncStorage.getItem(`celebrated_friend_${uid}`),
        AsyncStorage.getItem(`onboarding_done_${uid}`),
        AsyncStorage.getItem(`celebrated_plan_${uid}`),
        // SBD PRs for rank tier
        supabase
          .from('personal_records')
          .select('weight, reps, achieved_at, exercises!inner(name)')
          .eq('user_id', uid)
          .in('exercises.name', ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts'])
          .order('achieved_at', { ascending: false }),
        // Last completed workout
        supabase
          .from('workouts')
          .select('name, started_at, ended_at, workout_sets(weight, reps, exercises(name))')
          .eq('user_id', uid)
          .not('ended_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Friends' recent PRs
        supabase
          .from('personal_records')
          .select('user_id, weight, reps, achieved_at, exercises(name)')
          .neq('user_id', uid)
          .order('achieved_at', { ascending: false })
          .limit(8),
        // Friendships — needed for the crew activity card
        supabase
          .from('friendships')
          .select('requester_id, addressee_id')
          .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
          .eq('status', 'accepted'),
        // This week's workouts for the weekly strip
        supabase
          .from('workouts')
          .select('name, started_at, ended_at, workout_sets(weight, reps, exercises(name))')
          .eq('user_id', uid)
          .not('ended_at', 'is', null)
          .gte('started_at', weekStart.toISOString()),
      ]);

      // First steps
      const hasWorkout = (workoutCount ?? 0) > 0;
      const hasFriend = (friendCount ?? 0) > 0;
      // Durable server flag is the source of truth; fall back to the legacy
      // local flag and backfill it server-side so it survives re-login/reinstall.
      const serverPlanDone = (profile as any)?.weekly_plan_done === true;
      const hasCoach = serverPlanDone || weeklyPlanDone === 'true';
      if (hasCoach && !serverPlanDone) {
        supabase.from('users').update({ weekly_plan_done: true }).eq('id', uid).then(() => {});
      }
      const allDone = hasWorkout && hasFriend && hasCoach;
      const firstSteps = allDone ? null : { hasWorkout, hasFriend, hasCoach };

      // Celebrations — AsyncStorage-flag based, reliable across sessions
      if (onboardingDone === 'pending') {
        await AsyncStorage.setItem(`onboarding_done_${uid}`, 'shown');
        setCelebration({ emoji: '🎉', title: "You're in the system!", sub: 'Your arc officially begins. Go crush it.' });
      } else if (planPending === 'pending') {
        await AsyncStorage.setItem(`celebrated_plan_${uid}`, 'shown');
        setCelebration({ emoji: '⚡', title: 'Plan is being built!', sub: 'Coach is on it. Check the Insights tab.' });
      } else if (hasWorkout && !workoutCelebrated) {
        await AsyncStorage.setItem(`celebrated_workout_${uid}`, 'true');
        setCelebration({ emoji: '🔥', title: 'First workout logged!', sub: 'Your arc has officially begun.' });
      } else if (hasFriend && !friendCelebrated) {
        await AsyncStorage.setItem(`celebrated_friend_${uid}`, 'true');
        setCelebration({ emoji: '👥', title: 'Squad secured!', sub: 'Your crew is building.' });
      }

      // Rank — always computed fresh, never from stale state
      const bw = Math.max(profile?.bodyweight_lbs ?? 185, 50);
      const rankResult = prRes.data
        ? getRankResult(
            prRes.data.map((p: any) => ({
              exerciseName: p.exercises?.name ?? '',
              weight: p.weight,
              reps: p.reps,
              achievedAt: p.achieved_at,
            })),
            bw,
            true
          )
        : getRankResult([], bw);

      // Last workout
      let lastWorkout: LastWorkout | null = null;
      if (workoutRes.data) {
        const w = workoutRes.data as any;
        const sets = w.workout_sets ?? [];
        lastWorkout = {
          name: w.name,
          started_at: w.started_at,
          ended_at: w.ended_at,
          sets_count: sets.length,
          total_volume: sets.reduce((s: number, x: any) => s + x.weight * x.reps, 0),
          exercises: [...new Set(sets.map((s: any) => s.exercises?.name).filter(Boolean))] as string[],
        };
      }

      const friendIds = (friendshipsRes.data ?? []).map((f: any) =>
        f.requester_id === uid ? f.addressee_id : f.requester_id
      );

      // Wave 2 — the two queries that depend on wave-1 results, in parallel
      // (previously three sequential round trips).
      const prUserIds = Array.from(new Set((friendRes.data ?? []).map((pr: any) => pr.user_id)));
      const [prProfilesRes, recentPostRes] = await Promise.all([
        prUserIds.length > 0
          ? supabase.from('public_profiles').select('id, display_name, unit_pref').in('id', prUserIds)
          : Promise.resolve({ data: [] as any[] }),
        friendIds.length > 0
          ? supabase
              .from('workouts')
              .select('name, ended_at, notes, user_id, workout_sets(exercises(name))')
              .in('user_id', friendIds)
              .not('ended_at', 'is', null)
              .order('ended_at', { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null as any }),
      ]);

      const prProfileMap: Record<string, any> = {};
      (prProfilesRes.data ?? []).forEach((p: any) => { prProfileMap[p.id] = p; });

      // Friend PRs — names come from public_profiles (users-table RLS is own-row only)
      const friendPRs: FriendPR[] = (friendRes.data ?? []).map((pr: any) => ({
        display_name: prProfileMap[pr.user_id]?.display_name ?? 'Friend',
        exercise_name: pr.exercises.name,
        weight: pr.weight,
        reps: pr.reps,
        achieved_at: pr.achieved_at,
        unit_pref: prProfileMap[pr.user_id]?.unit_pref,
      }));

      // Crew activity card — poster name reuses the wave-2 profile map when
      // possible; only fetches (wave 3) when the poster isn't among PR-setters.
      let recentFriendPost: HomeData['recentFriendPost'] = null;
      const recentPost = recentPostRes.data as any;
      if (recentPost) {
        let posterName: string | undefined = prProfileMap[recentPost.user_id]?.display_name;
        if (!posterName) {
          const { data: posterProfile } = await supabase
            .from('public_profiles')
            .select('display_name')
            .eq('id', recentPost.user_id)
            .maybeSingle();
          posterName = posterProfile?.display_name ?? undefined;
        }
        const sets = recentPost.workout_sets ?? [];
        recentFriendPost = {
          displayName: posterName ?? 'Friend',
          workoutName: recentPost.name,
          notes: recentPost.notes?.trim() || undefined,
          exercises: [...new Set(sets.map((s: any) => s.exercises?.name).filter(Boolean))] as string[],
          endedAt: recentPost.ended_at,
        };
      }

      // Weekly strip (Mon–Sun)
      const workoutDays: Record<number, WorkoutDayData> = {};
      ((weekRes.data ?? []) as any[]).forEach(w => {
        const dow = new Date(w.started_at).getDay();
        const sets = (w.workout_sets ?? []) as any[];
        const exs = sets.map((s: any) => s.exercises?.name).filter(Boolean);
        const durationMins = w.ended_at
          ? Math.round((new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000)
          : 0;
        // Top lifts — best set per exercise, ranked by volume
        const byExercise = new Map<string, { weight: number; reps: number }>();
        sets.forEach((s: any) => {
          const name = s.exercises?.name;
          if (!name) return;
          const cur = byExercise.get(name);
          if (!cur || s.weight > cur.weight || (s.weight === cur.weight && s.reps > cur.reps)) {
            byExercise.set(name, { weight: s.weight, reps: s.reps });
          }
        });
        const topLifts = [...byExercise.entries()]
          .map(([name, best]) => ({ name, weight: best.weight, reps: best.reps }))
          .sort((a, b) => (b.weight * b.reps) - (a.weight * a.reps))
          .slice(0, 3);

        workoutDays[dow] = {
          sessionType: classifySession(exs) ?? 'Training',
          name: w.name ?? 'Workout',
          durationMins,
          topLifts,
        };
      });

      const fresh: HomeData = {
        firstSteps,
        creatorId: creator?.id ?? null,
        rankResult,
        lastWorkout,
        friendPRs,
        recentFriendPost,
        workoutDays,
      };
      cache = { userId: uid, data: fresh };
      setData(fresh);
    } catch (e) {
      // silence — keep whatever (cached) data is showing
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [user?.id, profile?.bodyweight_lbs, (profile as any)?.weekly_plan_done]);

  // Focus = render cache instantly (already in state), refresh silently.
  useFocusEffect(
    useCallback(() => {
      if (user) fetchData();
    }, [user?.id, fetchData])
  );

  // User switched (logout/login) — drop the other user's data.
  useEffect(() => {
    if (user && cache && cache.userId !== user.id) {
      cache = null;
      setData(null);
      setLoading(true);
    }
  }, [user?.id]);

  const markCoachStepDone = useCallback(() => {
    setData(prev => {
      if (!prev) return prev;
      const next = {
        ...prev,
        firstSteps: prev.firstSteps ? { ...prev.firstSteps, hasCoach: true } : prev.firstSteps,
      };
      if (cache && user && cache.userId === user.id) cache = { userId: user.id, data: next };
      return next;
    });
  }, [user?.id]);

  const clearCelebration = useCallback(() => setCelebration(null), []);

  return { data, loading, celebration, clearCelebration, refetch: fetchData, markCoachStepDone };
}
