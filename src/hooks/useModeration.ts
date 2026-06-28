import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// Reporting + blocking for App Store Guideline 1.2. Blocks are stored
// server-side (blocked_users) so the developer is notified of abusive accounts,
// and the blocked id list is used to hide that user's content client-side.
export function useModeration() {
  const { user } = useAuth();
  const [blockedIds, setBlockedIds] = useState<string[]>([]);

  const loadBlocks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', user.id);
    setBlockedIds((data ?? []).map((b: any) => b.blocked_id));
  }, [user]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  const reportContent = useCallback(async (opts: {
    reportedUserId?: string;
    contentType: 'workout' | 'profile' | 'comment' | 'user';
    contentId?: string;
    reason?: string;
  }): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.from('content_reports').insert({
      reporter_id: user.id,
      reported_user_id: opts.reportedUserId ?? null,
      content_type: opts.contentType,
      content_id: opts.contentId ?? null,
      reason: opts.reason ?? null,
    });
    return !error;
  }, [user]);

  const blockUser = useCallback(async (blockedId: string): Promise<boolean> => {
    if (!user || blockedId === user.id) return false;
    const { error } = await supabase
      .from('blocked_users')
      .upsert({ blocker_id: user.id, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' });
    if (!error) setBlockedIds(prev => (prev.includes(blockedId) ? prev : [...prev, blockedId]));
    return !error;
  }, [user]);

  const unblockUser = useCallback(async (blockedId: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', blockedId);
    if (!error) setBlockedIds(prev => prev.filter(id => id !== blockedId));
    return !error;
  }, [user]);

  return { blockedIds, reportContent, blockUser, unblockUser, reloadBlocks: loadBlocks };
}
