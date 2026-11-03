import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getRankResult, RANK_TIERS } from '@/constants/ranks';
import type { UserRow } from '@/lib/database.types';
import type { ExerciseSummary, FeedPost, Friend, PendingRequest } from './types';

export type FeedScope = 'friends' | 'global';

// SWR cache — returning to the Social tab renders the last data instantly
// and refreshes silently; the spinner shows only on a true first load.
let socialCache: {
  userId: string;
  scope: FeedScope;
  feed: FeedPost[];
  friends: Friend[];
  pending: PendingRequest[];
  myPower: number | null;
} | null = null;

/** Friends, requests, leaderboard power levels and the feed (friends or global). */
export function useSocialData(user: { id: string } | null, profile: UserRow | null) {
  const cached = socialCache && socialCache.userId === user?.id ? socialCache : null;
  const [feed, setFeed] = useState<FeedPost[]>(cached?.feed ?? []);
  const [friends, setFriends] = useState<Friend[]>(cached?.friends ?? []);
  const [pending, setPending] = useState<PendingRequest[]>(cached?.pending ?? []);
  const [myPower, setMyPower] = useState<number | null>(cached?.myPower ?? null);
  const [loading, setLoading] = useState(cached == null);
  const [refreshing, setRefreshing] = useState(false);
  const [feedScope, setFeedScopeState] = useState<FeedScope>('friends');
  const feedScopeRef = useRef<FeedScope>('friends');

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      // Wave 1 — friendships + block list in parallel
      const [{ data: friendships }, { data: blockedRows }] = await Promise.all([
        supabase
          .from('friendships')
          .select('id, status, requester_id, addressee_id')
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
        // Blocked users are hidden everywhere (Guideline 1.2)
        supabase.from('blocked_users').select('blocked_id').eq('blocker_id', user.id),
      ]);
      const blockedSet = new Set((blockedRows ?? []).map((b: any) => b.blocked_id));

      const otherId = (f: any) => (f.requester_id === user.id ? f.addressee_id : f.requester_id);
      const accepted = (friendships ?? [])
        .filter(f => f.status === 'accepted')
        .filter(f => !blockedSet.has(otherId(f)));
      const incoming = (friendships ?? [])
        .filter(f => f.status === 'pending' && f.addressee_id === user.id && !blockedSet.has(f.requester_id));
      const friendIds = accepted.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);

      // RLS on public.users only allows reading your own row — fetch everyone
      // else's safe, public fields via the public_profiles view instead.
      const profileIds = Array.from(new Set([
        user.id,
        ...friendIds,
        ...incoming.map(f => f.requester_id),
      ]));

      // Wave 2 — profiles, friend PRs (SBD + recent), and the feed query all
      // depend only on wave 1; previously these ran as 4 sequential stages.
      const global = feedScopeRef.current === 'global';
      const feedUserIds = [user.id, ...friendIds];
      let feedQuery = supabase
        .from('workouts')
        .select(`
          id, user_id, name, started_at, ended_at, notes, is_imported,
          workout_sets(weight, reps, set_number, exercises(name))
        `);
      if (!global) feedQuery = feedQuery.in('user_id', feedUserIds);

      const [profilesRes, sbdRes, recentRes, feedRes, powerRes] = await Promise.all([
        supabase
          .from('public_profiles')
          .select('id, display_name, username, avatar_url, bio, bodyweight_lbs, is_owner, is_og, is_pro')
          .in('id', profileIds),
        friendIds.length > 0
          ? supabase.from('personal_records').select('user_id, weight, reps, exercises!inner(name)')
              .in('user_id', friendIds)
              .in('exercises.name', ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts'])
          : Promise.resolve({ data: [] as any[] }),
        friendIds.length > 0
          ? supabase.from('personal_records').select('user_id, weight, reps, achieved_at, exercises(name)')
              .in('user_id', friendIds)
              .order('achieved_at', { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        feedQuery
          .not('ended_at', 'is', null)
          .or('is_imported.is.null,is_imported.eq.false')
          .order('ended_at', { ascending: false })
          .limit(30),
        // Power Level + stored rank (migration 029). Separate query so the
        // list still loads if 029 hasn't run — the error is just ignored.
        supabase
          .from('public_profiles')
          .select('id, power_level, power_confidence, rank_tier_key')
          .in('id', profileIds),
      ]);
      const powerById: Record<string, any> = {};
      if (!powerRes.error) (powerRes.data ?? []).forEach((p: any) => { powerById[p.id] = p; });

      const profilesById: Record<string, any> = {};
      (profilesRes.data ?? []).forEach((p: any) => { profilesById[p.id] = p; });

      const sbdByUser: Record<string, any[]> = {};
      (sbdRes.data ?? []).forEach((p: any) => {
        if (!sbdByUser[p.user_id]) sbdByUser[p.user_id] = [];
        sbdByUser[p.user_id].push(p);
      });
      const recentByUser: Record<string, any> = {};
      (recentRes.data ?? []).forEach((p: any) => {
        if (!recentByUser[p.user_id]) recentByUser[p.user_id] = p;
      });

      const pendingList: PendingRequest[] = incoming.map(f => ({
        id: f.requester_id,
        friendshipId: f.id,
        display_name: profilesById[f.requester_id]?.display_name ?? 'Unknown',
        avatar_url: profilesById[f.requester_id]?.avatar_url,
      }));
      setPending(pendingList);

      const workouts = feedRes.data;
      if (feedRes.error) {
        console.log('[Feed] error (non-fatal):', feedRes.error.message);
      }

      // Global scope: resolve display profiles for lifters outside the friend
      // circle, and drop anyone the viewer has blocked
      if (global) {
        const missingIds = [...new Set((workouts ?? []).map((w: any) => w.user_id))]
          .filter(id => !profilesById[id] && !blockedSet.has(id));
        if (missingIds.length > 0) {
          const { data: moreProfiles } = await supabase
            .from('public_profiles')
            .select('id, display_name, avatar_url, bodyweight_lbs, is_owner, is_og, is_pro')
            .in('id', missingIds);
          (moreProfiles ?? []).forEach((p: any) => { profilesById[p.id] = p; });
        }
      }

      // Per-user rank computed ONCE (was twice per post: label + color)
      const rankByUser: Record<string, { label: string; color: string } | null> = {};
      const rankFor = (uid: string, bw: number | undefined) => {
        if (!(uid in rankByUser)) {
          const stored = RANK_TIERS.find(t => t.key === powerById[uid]?.rank_tier_key);
          if (stored) { rankByUser[uid] = { label: stored.label, color: stored.color }; return rankByUser[uid]; }
          const prs = sbdByUser[uid] ?? [];
          rankByUser[uid] = prs.length > 0
            ? (() => {
                const r = getRankResult(prs.map((p: any) => ({
                  exerciseName: p.exercises?.name ?? '', weight: p.weight, reps: p.reps,
                })), bw ?? 185);
                return { label: r.tier.label, color: r.tier.color };
              })()
            : null;
        }
        return rankByUser[uid];
      };
      let emptyRankMemo: { label: string; color: string } | null = null;
      const emptyRank = () => {
        if (!emptyRankMemo) {
          const r = getRankResult([], 185);
          emptyRankMemo = { label: r.tier.label, color: r.tier.color };
        }
        return emptyRankMemo;
      };

      // Filter out imported workouts client-side (is_imported might not exist yet)
      const posts: FeedPost[] = (workouts ?? [])
        .filter((w: any) => !w.is_imported)
        .filter((w: any) => !blockedSet.has(w.user_id))
        .map((w: any) => {
          const isOwn = w.user_id === user.id;
          const other = profilesById[w.user_id] ?? null;
          const sets = w.workout_sets ?? [];
          const vol = sets.reduce((s: number, x: any) => s + x.weight * x.reps, 0);
          const exs = [...new Set(sets.map((s: any) => s.exercises?.name).filter(Boolean))] as string[];

          // Build per-exercise summary with top set
          const exMap: Record<string, { sets: any[] }> = {};
          sets.forEach((s: any) => {
            const name = s.exercises?.name ?? 'Unknown';
            if (!exMap[name]) exMap[name] = { sets: [] };
            exMap[name].sets.push(s);
          });
          const exerciseSummaries: ExerciseSummary[] = Object.entries(exMap).map(([name, data]) => {
            const topSet = data.sets.reduce((best: any, s: any) =>
              s.weight > best.weight ? s : best, data.sets[0]);
            const sortedSets = [...data.sets].sort((a: any, b: any) => (a.set_number ?? 0) - (b.set_number ?? 0));
            return {
              name,
              setCount: data.sets.length,
              topWeight: topSet?.weight ?? 0,
              topReps: topSet?.reps ?? 0,
              sets: sortedSets.map((s: any) => ({ weight: s.weight, reps: s.reps })),
            };
          });

          const rank = rankFor(w.user_id, other?.bodyweight_lbs);
          return {
            workoutId: w.id,
            userId: w.user_id,
            displayName: other?.display_name ?? 'Unknown',
            avatarUrl: other?.avatar_url,
            isOwner: isOwn ? profile?.is_owner : (other?.is_owner ?? false),
            isOg: isOwn ? profile?.is_og : (other?.is_og ?? false),
            isPro: isOwn ? profile?.is_pro : (other?.is_pro ?? false),
            workoutName: w.name,
            startedAt: w.started_at,
            endedAt: w.ended_at,
            notes: w.notes?.trim() || undefined,
            setsCount: sets.length,
            totalVolume: vol,
            exercises: exs,
            exerciseSummaries,
            photoUrl: undefined as string | undefined,
            likeCount: 0,
            isLiked: false,
            commentCount: 0,
            previewComments: [],
            rankTierLabel: rank?.label,
            rankTierColor: rank?.color,
          };
        });

      // Wave 3 — likes/comments/photos enrichment, wrapped so missing tables
      // don't kill the friends list
      let finalFeed: FeedPost[] = posts;
      try {
        if (posts.length > 0) {
          const workoutIds = posts.map(p => p.workoutId);
          const [likesRes, commentsRes, photosRes] = await Promise.all([
            supabase.from('workout_likes').select('workout_id, user_id').in('workout_id', workoutIds),
            supabase.from('workout_comments')
              .select('id, workout_id, content, created_at, user_id')
              .in('workout_id', workoutIds)
              .order('created_at', { ascending: false }),
            supabase.from('workout_photos').select('workout_id, photo_url').in('workout_id', workoutIds),
          ]);
          const myId = user!.id;
          finalFeed = posts.map(p => {
            const postComments = (commentsRes.data ?? [])
              .filter((c: any) => c.workout_id === p.workoutId)
              .filter((c: any) => !blockedSet.has(c.user_id)); // hide blocked users' comments
            return {
              ...p,
              likeCount: (likesRes.data ?? []).filter((l: any) => l.workout_id === p.workoutId).length,
              isLiked: (likesRes.data ?? []).some((l: any) => l.workout_id === p.workoutId && l.user_id === myId),
              commentCount: postComments.length,
              // Most recent 2 comments, oldest-first for natural reading order
              previewComments: postComments.slice(0, 2).reverse().map((c: any) => ({
                id: c.id,
                content: c.content,
                displayName: profilesById[c.user_id]?.display_name ?? 'Unknown',
                avatarUrl: profilesById[c.user_id]?.avatar_url,
              })),
              photoUrl: (photosRes.data ?? []).find((ph: any) => ph.workout_id === p.workoutId)?.photo_url,
            };
          });
        }
      } catch (enrichErr) {
        console.log('[Feed] enrichment skipped (tables may not exist):', enrichErr);
      }
      setFeed(finalFeed);

      const friendList: Friend[] = accepted
        .map(f => {
          const oId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
          const other = profilesById[oId];
          if (!other?.id) return null;
          // Friends always show a tier (empty PRs = base tier), matching the
          // original always-computed behavior
          const rank = rankFor(other.id, other.bodyweight_lbs) ?? emptyRank();
          const pr = recentByUser[other.id];
          return {
            id: other.id,
            display_name: other.display_name ?? 'Unknown',
            username: other.username ?? undefined,
            avatar_url: other.avatar_url,
            bio: other.bio,
            bodyweight_lbs: other.bodyweight_lbs,
            friendshipId: f.id,
            rankTierLabel: rank.label,
            rankTierColor: rank.color,
            powerLevel: powerById[other.id]?.power_level ?? null,
            powerPartial: powerById[other.id]?.power_confidence === 'partial',
            is_owner: other.is_owner ?? false,
            is_og: other.is_og ?? false,
            is_pro: other.is_pro ?? false,
            recentPR: pr ? {
              exerciseName: pr.exercises?.name ?? '',
              weight: pr.weight,
              achieved_at: pr.achieved_at,
            } : undefined,
          };
        })
        .filter(Boolean) as Friend[];
      setFriends(friendList);

      const mine = powerById[user.id]?.power_level ?? null;
      setMyPower(mine);
      socialCache = {
        myPower: mine,
        userId: user.id,
        scope: feedScopeRef.current,
        feed: finalFeed,
        friends: friendList,
        pending: pendingList,
      };
    } catch (e) {
      // silence — keep whatever (cached) data is showing
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const setFeedScope = (scope: FeedScope) => {
    if (feedScopeRef.current === scope) return;
    feedScopeRef.current = scope;
    setFeedScopeState(scope);
    setRefreshing(true);
    loadData();
  };
  const refresh = () => { setRefreshing(true); loadData(); };

  return {
    feed, setFeed, friends, setFriends, pending, setPending, myPower,
    loading, refreshing, refresh, reload: loadData, feedScope, setFeedScope,
  };
}
