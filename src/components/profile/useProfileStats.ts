import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { computeStreak } from '@/lib/streak';
import { computePowerReading, type PowerReading } from '@/lib/powerLevel';
import { fetchPowerInputs } from '@/lib/powerData';
import { unitFromProfile } from '@/lib/units';
import type { UserRow } from '@/lib/database.types';

export interface ProfileStats {
  totalWorkouts: number;
  totalVolume: number;
  streakDays: number;
  friendCount: number;
  /** 30-day sets per muscle group (heatmap) */
  muscleVolume: Record<string, number>;
  power: PowerReading;
}

// Module-level stale-while-revalidate cache: a revisit renders the last
// known stats instantly and refreshes silently, instead of a spinner.
const cache = new Map<string, ProfileStats>();

// Lifetime volume. Supabase caps a response at 1000 rows — page through.
async function fetchLifetimeVolume(userId: string): Promise<number> {
  const PAGE = 1000;
  let from = 0;
  let volume = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('workout_sets')
      .select('id, weight, reps, workouts!inner(user_id)')
      .eq('workouts.user_id', userId)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    for (const x of data as any[]) volume += (Number(x.weight) || 0) * (x.reps ?? 0);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return volume;
}

export function useProfileStats(userId: string | undefined, profile: UserRow | null) {
  const [stats, setStats] = useState<ProfileStats | null>(userId ? cache.get(userId) ?? null : null);
  const [loading, setLoading] = useState(!stats);

  const load = useCallback(async () => {
    if (!userId) return;
    if (!cache.has(userId)) setLoading(true);
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const [{ data: workouts }, { count: friends }, volume, powerInputs] = await Promise.all([
        supabase.from('workouts').select('id, started_at').eq('user_id', userId).not('ended_at', 'is', null),
        supabase.from('friendships').select('id', { count: 'exact', head: true })
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`).eq('status', 'accepted'),
        fetchLifetimeVolume(userId),
        fetchPowerInputs(userId),
      ]);

      // 30-day muscle heatmap: count sets (not weight×reps) so bodyweight work registers.
      const recentIds = (workouts ?? []).filter((w: any) => w.started_at >= thirtyDaysAgo).map((w: any) => w.id);
      const { data: recentSets } = recentIds.length > 0
        ? await supabase.from('workout_sets').select('exercises(muscle_group)').in('workout_id', recentIds)
        : { data: [] as any[] };
      const muscleVolume: Record<string, number> = {};
      for (const s of (recentSets ?? []) as any[]) {
        const mg = s.exercises?.muscle_group;
        if (mg) muscleVolume[mg] = (muscleVolume[mg] ?? 0) + 1;
      }

      const next: ProfileStats = {
        totalWorkouts: workouts?.length ?? 0,
        totalVolume: volume,
        streakDays: computeStreak((workouts ?? []).map((w: any) => w.started_at)),
        friendCount: friends ?? 0,
        muscleVolume,
        // Rank comes from the Power Level's per-lift e1RMs — same source as Home.
        power: computePowerReading(powerInputs, profile?.bodyweight_lbs, profile?.gender, unitFromProfile(profile?.unit_pref)),
      };
      cache.set(userId, next);
      setStats(next);
    } catch {
      // keep cached
    } finally {
      setLoading(false);
    }
  }, [userId, profile?.bodyweight_lbs, profile?.gender, profile?.unit_pref]);

  useEffect(() => { load(); }, [load]);

  // Tab screens stay mounted: refresh silently on every revisit.
  const focusedOnce = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!focusedOnce.current) { focusedOnce.current = true; return; }
    load();
  }, [load]));

  return { stats, loading, reload: load };
}
