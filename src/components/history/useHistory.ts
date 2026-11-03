import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { WeightUnit } from '@/lib/units';
import { mapWorkoutRows, type WorkoutData } from './historyData';

const PAGE = 60;

/**
 * Paged workout history. Free users see 90 days; Pro pages through
 * everything. Refocus / pull refreshes the newest page silently and keeps
 * older pages the user already scrolled into.
 */
export function useHistory(userId: string | undefined, unit: WeightUnit, isPro: boolean) {
  const [workouts, setWorkouts] = useState<WorkoutData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadKey, setLoadKey] = useState(0);
  const loadingMore = useRef(false);
  const isProRef = useRef(isPro);
  isProRef.current = isPro;
  const prTimes = useRef<number[]>([]);

  const fetchPage = useCallback(async (from: number): Promise<WorkoutData[] | null> => {
    if (!userId) return null;
    let q = supabase
      .from('workouts')
      .select('*, workout_sets(weight, reps, set_number, rpe, note, logged_at, exercises(name, muscle_group))')
      .eq('user_id', userId)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (!isProRef.current) q = q.gte('started_at', new Date(Date.now() - 90 * 86400000).toISOString());
    const [{ data }, prs] = await Promise.all([
      q,
      from === 0
        ? supabase.from('personal_records').select('achieved_at').eq('user_id', userId)
        : Promise.resolve(null),
    ]);
    if (prs?.data) prTimes.current = (prs.data as any[]).map(p => new Date(p.achieved_at).getTime());
    return data ? mapWorkoutRows(data, unit, prTimes.current) : null;
  }, [userId, unit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) return;
      if (loadKey === 0) setLoading(true);
      const fresh = await fetchPage(0);
      if (cancelled) return;
      if (fresh) {
        const all = fresh.length < PAGE;
        setWorkouts(prev => {
          if (loadKey === 0 || prev.length === 0 || all) return fresh;
          const oldest = fresh[fresh.length - 1].started_at;
          const ids = new Set(fresh.map(w => w.id));
          return [...fresh, ...prev.filter(w => !ids.has(w.id) && w.started_at < oldest)];
        });
        if (loadKey === 0 || all) setHasMore(!all);
      }
      setLoading(false);
      setRefreshing(false);
    })();
    return () => { cancelled = true; };
  }, [loadKey, userId]);

  // Tab screens stay mounted: a just-finished workout appears on refocus.
  const focusedOnce = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!focusedOnce.current) { focusedOnce.current = true; return; }
    setLoadKey(k => k + 1);
  }, []));

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore.current || loading) return;
    loadingMore.current = true;
    try {
      const next = await fetchPage(workouts.length);
      if (next) {
        setWorkouts(prev => {
          const ids = new Set(prev.map(w => w.id));
          return [...prev, ...next.filter(w => !ids.has(w.id))];
        });
        setHasMore(next.length === PAGE);
      }
    } finally {
      loadingMore.current = false;
    }
  }, [hasMore, loading, workouts.length, fetchPage]);

  const refresh = () => { setRefreshing(true); setLoadKey(k => k + 1); };
  const remove = async (id: string) => {
    await supabase.from('workouts').delete().eq('id', id);
    setWorkouts(prev => prev.filter(w => w.id !== id));
  };

  return { workouts, loading, refreshing, refresh, loadMore, remove };
}
