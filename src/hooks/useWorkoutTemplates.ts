import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface TemplateExercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment_type?: string;
}

export interface DaySuggestion {
  name: string;
  dayLabel: string;
  exercises: TemplateExercise[];
  isPinned?: boolean;
  pinnedTemplateId?: string;
}

export interface RecentTemplate {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  muscleGroups: string[];
  lastUsed: string;
}

interface TemplatesData {
  daySuggestion: DaySuggestion | null;
  templates: RecentTemplate[];
  savedTemplates: any[];
  lastWorkoutExercises: TemplateExercise[];
}

// SWR cache — the idle screen previously re-ran its full load on every mount
// (every return to the tab without an active workout). Cached data renders
// instantly; the load still refreshes it in the background.
let cache: { userId: string; data: TemplatesData } | null = null;

function parseExercises(w: any): TemplateExercise[] {
  const seen = new Set<string>();
  const exs: TemplateExercise[] = [];
  for (const s of w.workout_sets ?? []) {
    const ex = s.exercises;
    if (ex && !seen.has(ex.id)) {
      seen.add(ex.id);
      exs.push({ id: ex.id, name: ex.name, muscle_group: ex.muscle_group, equipment_type: ex.equipment_type });
    }
  }
  return exs;
}

/** Idle-screen data: day suggestion, quick-start templates, saved templates. */
export function useWorkoutTemplates(enabled: boolean) {
  const { user } = useAuth();
  const [data, setData] = useState<TemplatesData | null>(
    cache && cache.userId === user?.id ? cache.data : null
  );
  const [loading, setLoading] = useState(data == null);
  const inFlight = useRef(false);

  const commit = useCallback((next: TemplatesData) => {
    if (user) cache = { userId: user.id, data: next };
    setData(next);
  }, [user?.id]);

  const refetch = useCallback(async () => {
    if (!user || inFlight.current) return;
    inFlight.current = true;
    try {
      const todayDow = new Date().getDay();
      const [{ data: recents }, { data: saved }, { data: pinnedTmpl }] = await Promise.all([
        supabase
          .from('workouts')
          .select('id, name, started_at, workout_sets(exercises(id, name, muscle_group, equipment_type))')
          .eq('user_id', user.id)
          .not('ended_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(20),
        supabase
          .from('workout_templates')
          .select('*')
          .eq('user_id', user.id)
          .order('last_used_at', { ascending: false, nullsFirst: false }),
        supabase
          .from('workout_templates')
          .select('*')
          .eq('user_id', user.id)
          .eq('day_of_week', todayDow)
          .limit(1)
          .maybeSingle(),
      ]);

      // Day suggestion — prefer pinned template for today, else same-weekday history
      let daySuggestion: DaySuggestion | null = null;
      if (pinnedTmpl && (pinnedTmpl as any).exercises?.length > 0) {
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][todayDow];
        daySuggestion = {
          name: (pinnedTmpl as any).name,
          dayLabel: `📌 Your ${dayName} plan`,
          exercises: (pinnedTmpl as any).exercises,
          isPinned: true,
          pinnedTemplateId: (pinnedTmpl as any).id,
        };
      } else {
        const sameDayWorkout = (recents ?? []).find((w: any) => new Date(w.started_at).getDay() === todayDow);
        if (sameDayWorkout) {
          const exs = parseExercises(sameDayWorkout);
          if (exs.length > 0) {
            const daysAgo = Math.floor((Date.now() - new Date((sameDayWorkout as any).started_at).getTime()) / 86400000);
            const label = daysAgo === 7 ? 'Last week' : daysAgo === 14 ? '2 weeks ago' : `${daysAgo}d ago`;
            daySuggestion = { name: (sameDayWorkout as any).name, dayLabel: label, exercises: exs };
          }
        }
      }

      // Recent-session templates — dedupe by name, most recent per name
      const seen = new Map<string, any>();
      for (const w of recents ?? []) {
        if (!seen.has((w as any).name)) seen.set((w as any).name, w);
      }
      const templates: RecentTemplate[] = Array.from(seen.values()).slice(0, 6).map((w: any) => {
        const exs = parseExercises(w);
        return {
          id: w.id, name: w.name, exercises: exs,
          muscleGroups: [...new Set(exs.map(e => e.muscle_group))],
          lastUsed: w.started_at,
        };
      });

      commit({
        daySuggestion,
        templates,
        savedTemplates: saved ?? [],
        lastWorkoutExercises: recents?.[0] ? parseExercises(recents[0]) : [],
      });
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [user?.id, commit]);

  useEffect(() => {
    if (enabled && user) refetch();
    if (user && cache && cache.userId !== user.id) {
      cache = null;
      setData(null);
      setLoading(true);
    }
  }, [enabled, user?.id, refetch]);

  // Local mutation for pin/unpin without a full reload
  const setDaySuggestion = useCallback((updater: (prev: DaySuggestion | null) => DaySuggestion | null) => {
    setData(prev => {
      if (!prev) return prev;
      const next = { ...prev, daySuggestion: updater(prev.daySuggestion) };
      if (user && cache?.userId === user.id) cache = { userId: user.id, data: next };
      return next;
    });
  }, [user?.id]);

  return {
    daySuggestion: data?.daySuggestion ?? null,
    templates: data?.templates ?? [],
    savedTemplates: data?.savedTemplates ?? [],
    lastWorkoutExercises: data?.lastWorkoutExercises ?? [],
    loadingTemplates: loading && !data,
    refetch,
    setDaySuggestion,
  };
}
