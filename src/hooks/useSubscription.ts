import { useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabase';

// Weekly AI ask limit for free users
const FREE_AI_ASKS_PER_WEEK = 5;

export function useSubscription() {
  const { profile, user, refreshProfile } = useAuth();

  const isPro = profile?.is_pro ?? false;

  // Check if weekly counter needs reset
  const isNewWeek = () => {
    if (!profile?.ai_asks_week_start) return true;
    const weekStart = new Date(profile.ai_asks_week_start);
    const now = new Date();
    const diffDays = (now.getTime() - weekStart.getTime()) / 86400000;
    return diffDays >= 7;
  };

  const aiAsksUsed = isNewWeek() ? 0 : (profile?.ai_asks_count ?? 0);
  const aiAsksRemaining = isPro ? Infinity : Math.max(0, FREE_AI_ASKS_PER_WEEK - aiAsksUsed);
  const canAskCoach = isPro || aiAsksRemaining > 0;

  // When the rolling 7-day window refills (null when Pro or no asks used yet)
  const aiAsksResetDate = !isPro && !isNewWeek() && profile?.ai_asks_week_start
    ? new Date(new Date(profile.ai_asks_week_start).getTime() + 7 * 86400000)
    : null;

  // Pre-flight check before sending an AI message — returns false if at limit.
  // The actual count is incremented server-side by the ai-coach edge function
  // (ai_asks_count / ai_asks_week_start are locked to server-only writes —
  // see migration 014 — so the client can no longer write them directly,
  // which also closes a free-Pro-unlock exploit). Call refreshProfile()
  // after the coach responds to pick up the server-incremented value.
  const recordAIAsk = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    if (isPro) return true;

    const currentCount = isNewWeek() ? 0 : (profile?.ai_asks_count ?? 0);
    return currentCount < FREE_AI_ASKS_PER_WEEK;
  }, [user, isPro, profile]);

  // History date limit for free users (90 days)
  const historyLimit = isPro ? null : new Date(Date.now() - 90 * 86400000);

  return {
    isPro,
    canAskCoach,
    aiAsksRemaining,
    aiAsksUsed,
    aiAsksResetDate,
    recordAIAsk,
    historyLimit,
    canImport: isPro || true, // generous on import for now
    canExport: isPro,
  };
}
