import { useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabase';

// Weekly AI ask limit for free users
const FREE_AI_ASKS_PER_WEEK = 3;

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

  // Call before each AI message — returns false if at limit
  const recordAIAsk = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    if (isPro) return true;

    const needsReset = isNewWeek();
    const currentCount = needsReset ? 0 : (profile?.ai_asks_count ?? 0);

    if (currentCount >= FREE_AI_ASKS_PER_WEEK) return false;

    await supabase.from('users').update({
      ai_asks_count: currentCount + 1,
      ai_asks_week_start: needsReset ? new Date().toISOString() : profile?.ai_asks_week_start,
    }).eq('id', user.id);

    await refreshProfile();
    return true;
  }, [user, isPro, profile]);

  // History date limit for free users (90 days)
  const historyLimit = isPro ? null : new Date(Date.now() - 90 * 86400000);

  return {
    isPro,
    canAskCoach,
    aiAsksRemaining,
    aiAsksUsed,
    recordAIAsk,
    historyLimit,
    canImport: isPro || true, // generous on import for now
    canExport: isPro,
  };
}
