import { useEffect, useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, RefreshControl, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { CameraView, Camera } from 'expo-camera';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/colors';
import { getRankResult } from '@/constants/ranks';
import { FriendProfileModal } from '@/components/FriendProfileModal';
import { UserBadges } from '@/components/UserBadges';
import { useModeration } from '@/hooks/useModeration';
import { screenText } from '@/lib/contentFilter';
import { toDisplay, fmtVolume as fmtVolumeUnit, unitFromProfile } from '@/lib/units';

type SubTab = 'feed' | 'people';

interface ExerciseSummary {
  name: string;
  setCount: number;
  topWeight: number;
  topReps: number;
  sets: { weight: number; reps: number }[];
}

interface FeedComment {
  id: string;
  content: string;
  displayName: string;
  avatarUrl?: string;
}

interface FeedPost {
  workoutId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  isOwner?: boolean;
  isOg?: boolean;
  isPro?: boolean;
  workoutName: string;
  startedAt: string;
  endedAt: string;
  notes?: string;
  setsCount: number;
  totalVolume: number;
  exercises: string[];
  exerciseSummaries: ExerciseSummary[];
  rankTierLabel?: string;
  rankTierColor?: string;
  photoUrl?: string;
  likeCount: number;
  isLiked: boolean;
  commentCount: number;
  previewComments: FeedComment[];
}

interface Friend {
  id: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  bodyweight_lbs?: number;
  friendshipId: string;
  rankTierLabel?: string;
  rankTierColor?: string;
  recentPR?: { exerciseName: string; weight: number; achieved_at: string };
  is_owner?: boolean;
  is_og?: boolean;
  is_pro?: boolean;
}

interface PendingRequest {
  id: string;
  friendshipId: string;
  display_name: string;
  avatar_url?: string;
}

function Avatar({ url, name, color, size = 44 }: { url?: string; name: string; color: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color + '20',
      borderWidth: 2, borderColor: color + '60',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {url
        ? <Image source={{ uri: url }} style={{ width: size, height: size }} cachePolicy="disk" transition={150} />
        : <Text style={{ color, fontWeight: '800', fontSize: size * 0.3 }}>{initials}</Text>
      }
    </View>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: days > 365 ? 'numeric' : undefined });
}

function formatVolume(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
}

// SWR cache — returning to the Social tab renders the last data instantly
// and refreshes silently; the spinner shows only on a true first load.
let socialCache: {
  userId: string;
  scope: 'friends' | 'global';
  feed: FeedPost[];
  friends: Friend[];
  pending: PendingRequest[];
} | null = null;

function formatDuration(start: string, end: string) {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function SocialScreen() {
  const { user, profile } = useAuth();
  const unit = unitFromProfile(profile?.unit_pref);
  const { reportContent, blockUser } = useModeration();
  const [subTab, setSubTab] = useState<SubTab>('feed');
  // Feed scope: friends-only or the global (public-profiles) feed.
  // Ref mirrors state so loadData reads the current scope without re-binding.
  const [feedScope, setFeedScope] = useState<'friends' | 'global'>('friends');
  const feedScopeRef = useRef<'friends' | 'global'>('friends');
  const cached = socialCache && socialCache.userId === user?.id ? socialCache : null;
  const [feed, setFeed] = useState<FeedPost[]>(cached?.feed ?? []);
  const [friends, setFriends] = useState<Friend[]>(cached?.friends ?? []);
  const [pending, setPending] = useState<PendingRequest[]>(cached?.pending ?? []);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(cached == null);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [suggested, setSuggested] = useState<any[]>([]);
  const scanHandled = useRef(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

  // Comments
  const [commentWorkoutId, setCommentWorkoutId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

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

      const [profilesRes, sbdRes, recentRes, feedRes] = await Promise.all([
        supabase
          .from('public_profiles')
          .select('id, display_name, avatar_url, bio, bodyweight_lbs, is_owner, is_og, is_pro')
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
      ]);

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
            avatar_url: other.avatar_url,
            bio: other.bio,
            bodyweight_lbs: other.bodyweight_lbs,
            friendshipId: f.id,
            rankTierLabel: rank.label,
            rankTierColor: rank.color,
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

      socialCache = {
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

  // Report / block a feed post's author (Guideline 1.2)
  const openPostSafetyMenu = (post: FeedPost) => {
    if (post.userId === user?.id) return;
    Alert.alert(post.displayName, 'Keep STR safe', [
      {
        text: 'Report post',
        onPress: async () => {
          const ok = await reportContent({
            reportedUserId: post.userId,
            contentType: 'workout',
            contentId: post.workoutId,
          });
          Alert.alert(ok ? 'Reported' : 'Error', ok
            ? 'Thanks — our team will review this within 24 hours.'
            : 'Could not file the report. Please try again.');
        },
      },
      {
        text: `Block ${post.displayName}`,
        style: 'destructive',
        onPress: () => {
          Alert.alert('Block user', `Block ${post.displayName}? Their posts will be removed from your feed.`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                const ok = await blockUser(post.userId);
                if (ok) { setFeed(prev => prev.filter(p => p.userId !== post.userId)); loadData(); }
                else Alert.alert('Error', 'Could not block this user. Please try again.');
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Auto-open creator profile if navigated from First Steps on home
  useFocusEffect(useCallback(() => {
    const creatorToOpen = (global as any).__openFriendProfile;
    if (creatorToOpen) {
      (global as any).__openFriendProfile = null;
      setSubTab('people');
      setTimeout(() => setSelectedFriendId(creatorToOpen), 300);
    }
  }, []));

  const handleSearch = async () => {
    if (!search.trim() || !user) return;
    setSearching(true);
    try {
      const q = search.trim().replace(/^@/, '');
      const { data: users, error: searchError } = await supabase
        .from('public_profiles')
        .select('id, display_name, avatar_url, bio, username')
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
        .neq('id', user.id)
        .limit(10);

      if (searchError) {
        Alert.alert('Search error', searchError.message);
        return;
      }
      console.log('[Search] query:', q, 'results:', users?.length, users?.map(u => u.username));

      const { data: myFriendships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, status')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      const friendIds = new Set((myFriendships ?? [])
        .filter(f => f.status === 'accepted')
        .map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id));
      const sentIds = new Set((myFriendships ?? [])
        .filter(f => f.status === 'pending' && f.requester_id === user.id)
        .map(f => f.addressee_id));

      setSearchResults((users ?? []).map((u: any) => ({
        ...u,
        alreadyFriend: friendIds.has(u.id),
        requestSent: sentIds.has(u.id),
      })));
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (toId: string) => {
    if (!user) return;
    const { data: row } = await supabase
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: toId })
      .select('status')
      .single();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchResults(prev => prev.map(u => u.id === toId ? { ...u, requestSent: true } : u));
    // Creator requests auto-accept server-side — reload so they appear as a
    // friend immediately instead of after the next pull-to-refresh
    if (row?.status === 'accepted') loadData();
  };

  const acceptRequest = async (friendshipId: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadData();
  };

  const declineRequest = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    setPending(prev => prev.filter(p => p.friendshipId !== friendshipId));
  };

  const toggleLike = async (workoutId: string, isLiked: boolean) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Optimistic update
    setFeed(prev => prev.map(p => p.workoutId === workoutId
      ? { ...p, isLiked: !isLiked, likeCount: p.likeCount + (isLiked ? -1 : 1) }
      : p
    ));
    if (isLiked) {
      await supabase.from('workout_likes').delete().eq('workout_id', workoutId).eq('user_id', user.id);
    } else {
      await supabase.from('workout_likes').insert({ workout_id: workoutId, user_id: user.id });
    }
  };

  const openComments = async (workoutId: string) => {
    setCommentWorkoutId(workoutId);
    setComments([]);
    setLoadingComments(true);
    const { data } = await supabase
      .from('workout_comments')
      .select('id, content, created_at, user_id')
      .eq('workout_id', workoutId)
      .order('created_at', { ascending: true });

    const userIds = Array.from(new Set((data ?? []).map((c: any) => c.user_id)));
    const { data: profiles } = userIds.length > 0
      ? await supabase.from('public_profiles').select('id, display_name, avatar_url').in('id', userIds)
      : { data: [] as any[] };
    const profileMap: Record<string, any> = {};
    (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });

    setComments((data ?? []).map((c: any) => ({
      ...c,
      users: { display_name: profileMap[c.user_id]?.display_name, avatar_url: profileMap[c.user_id]?.avatar_url },
    })));
    setLoadingComments(false);
  };

  const sendComment = async () => {
    if (!commentText.trim() || !user || !commentWorkoutId) return;
    const commentIssue = screenText(commentText, 'comment');
    if (commentIssue) { Alert.alert('Not allowed', commentIssue); return; }
    setSendingComment(true);
    const { data } = await supabase
      .from('workout_comments')
      .insert({ workout_id: commentWorkoutId, user_id: user.id, content: commentText.trim() })
      .select('id, content, created_at, users(display_name, avatar_url)')
      .single();
    if (data) {
      setComments(prev => [...prev, data]);
      setFeed(prev => prev.map(p => p.workoutId === commentWorkoutId
        ? {
            ...p,
            commentCount: p.commentCount + 1,
            previewComments: [...p.previewComments, {
              id: (data as any).id,
              content: (data as any).content,
              displayName: (data as any).users?.display_name ?? 'Unknown',
              avatarUrl: (data as any).users?.avatar_url,
            }].slice(-2),
          }
        : p
      ));
    }
    setCommentText('');
    setSendingComment(false);
  };

  const openScanner = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status === 'granted') {
      scanHandled.current = false; // reset for new scan session
      setShowScanner(true);
    } else {
      Alert.alert('Camera permission needed to scan QR codes');
    }
  };

  const handleQRScan = async ({ data }: { data: string }) => {
    if (scanHandled.current) return; // prevent duplicate fires
    scanHandled.current = true;
    setShowScanner(false);
    // QR value is "str://profile/USER_ID"
    const match = data.match(/str:\/\/profile\/(.+)/);
    if (!match) { Alert.alert('Invalid QR code'); return; }
    const scannedUserId = match[1];
    if (scannedUserId === user?.id) { Alert.alert('That\'s your own QR code 😄'); return; }

    // Check if already friends
    const alreadyFriend = friends.find(f => f.id === scannedUserId);
    if (alreadyFriend) { Alert.alert('Already friends!'); return; }

    // Get their profile
    const { data: profile } = await supabase
      .from('public_profiles')
      .select('display_name, username')
      .eq('id', scannedUserId)
      .single();

    const name = profile?.display_name ?? 'this person';
    Alert.alert(
      `Add ${name}?`,
      profile?.username ? `@${profile.username}` : undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add Friend', onPress: () => sendRequest(scannedUserId) },
      ]
    );
  };

  const loadSuggested = async () => {
    if (!user || friends.length === 0) return;
    // Suggest users with similar SBD tier who aren't already friends
    const { data } = await supabase
      .from('public_profiles')
      .select('id, display_name, username, avatar_url, bodyweight_lbs')
      .neq('id', user.id)
      .not('id', 'in', `(${friends.map(f => f.id).join(',')})`)
      .not('display_name', 'is', null)
      .limit(6);
    setSuggested(data ?? []);
  };

  const removeFriend = (friendshipId: string, name: string) => {
    Alert.alert('Remove', `Remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await supabase.from('friendships').delete().eq('id', friendshipId);
        setFriends(prev => prev.filter(f => f.friendshipId !== friendshipId));
      }},
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      {/* Header + tabs */}
      <View style={{
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
      }}>
        <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -1, marginBottom: 14 }}>
          Social
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {([
            { key: 'feed' as SubTab, label: 'Feed' },
            { key: 'people' as SubTab, label: `Friends${friends.length > 0 ? ` (${friends.length})` : ''}` },
          ]).map(t => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setSubTab(t.key)}
              style={{
                paddingHorizontal: 16, paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: subTab === t.key ? Colors.accentDim : 'transparent',
                borderWidth: 1,
                borderColor: subTab === t.key ? Colors.accent + '50' : 'transparent',
              }}
            >
              <Text style={{
                color: subTab === t.key ? Colors.accent : Colors.textMuted,
                fontSize: 13, fontWeight: subTab === t.key ? '800' : '500',
              }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Feed scope switch — your circle vs the whole gym */}
      {subTab === 'feed' && (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
          {(['friends', 'global'] as const).map(scope => (
            <TouchableOpacity
              key={scope}
              onPress={() => {
                if (feedScope === scope) return;
                setFeedScope(scope);
                feedScopeRef.current = scope;
                setRefreshing(true);
                loadData();
              }}
              style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14,
                backgroundColor: feedScope === scope ? Colors.accentDim : Colors.surface,
                borderWidth: 1, borderColor: feedScope === scope ? Colors.accent + '50' : 'transparent',
              }}
            >
              <Text style={{ color: feedScope === scope ? Colors.accent : Colors.textMuted, fontWeight: '700', fontSize: 12 }}>
                {scope === 'friends' ? 'Friends' : '🌍 Global'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── FEED ──────────────────────────────────────────────────────────── */}
      {subTab === 'feed' && (
        loading ? (
          <View style={{ flex: 1 }}>
            <ActivityIndicator color={Colors.accent} style={{ marginTop: 60 }} />
          </View>
        ) : friends.length === 0 && feedScope === 'friends' ? (
          <ScrollView
            contentContainerStyle={{ padding: 16, flexGrow: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.accent} />}
          >
            <View style={{ alignItems: 'center', marginTop: 80, gap: 8 }}>
              <Text style={{ color: Colors.textMuted, fontSize: 20 }}>👥</Text>
              <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700' }}>No friends yet</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center' }}>
                Add friends in the Friends tab to see their workouts here.
              </Text>
              <TouchableOpacity
                onPress={() => setSubTab('people')}
                style={{ marginTop: 12, backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}
              >
                <Text style={{ color: Colors.text, fontWeight: '700' }}>Find Friends →</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : feed.length === 0 ? (
          <ScrollView
            contentContainerStyle={{ padding: 16, flexGrow: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.accent} />}
          >
            <View style={{ alignItems: 'center', marginTop: 80, gap: 8 }}>
              <Text style={{ color: Colors.textMuted, fontSize: 20 }}>🏋️</Text>
              <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700' }}>No workouts yet</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                When your friends finish a workout it shows here. Get them lifting.
              </Text>
            </View>
          </ScrollView>
        ) : (
          <FlashList
            data={feed}
            keyExtractor={post => post.workoutId}
            contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.accent} />}
            renderItem={({ item: post }) => (
              <View style={{
                backgroundColor: Colors.surface,
                borderRadius: 18,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: (post.rankTierColor ?? Colors.accent) + '22',
                overflow: 'hidden',
                shadowColor: post.rankTierColor ?? Colors.accent,
                shadowOpacity: 0.07,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
              }}>
                {/* Tier accent strip */}
                <View style={{ height: 3, backgroundColor: post.rankTierColor ?? Colors.accent, opacity: 0.65 }} />

                {/* Photo — square crop, full bleed, no black bars */}
                {post.photoUrl && (
                  <Image
                    source={{ uri: post.photoUrl }}
                    style={{ width: '100%', aspectRatio: 1 }}
                    contentFit="cover"
                    cachePolicy="disk"
                    transition={150}
                  />
                )}

                {/* Post header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedFriendId(post.userId)}
                    activeOpacity={0.8}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 }}
                  >
                    <Avatar url={post.avatarUrl} name={post.displayName} color={post.rankTierColor ?? Colors.accent} size={42} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800' }}>
                          {post.displayName}
                        </Text>
                        <UserBadges isOwner={post.isOwner} isOg={post.isOg} isPro={post.isPro} size="sm" />
                        {post.rankTierLabel && (
                          <View style={{
                            backgroundColor: (post.rankTierColor ?? Colors.accent) + '20',
                            borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2,
                            borderWidth: 1, borderColor: (post.rankTierColor ?? Colors.accent) + '40',
                          }}>
                            <Text style={{ color: post.rankTierColor ?? Colors.accent, fontSize: 8, fontWeight: '800', letterSpacing: 1.5 }}>
                              {post.rankTierLabel}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>
                        {timeAgo(post.endedAt)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {/* Report / block — only on other users' posts */}
                  {post.userId !== user?.id && (
                    <TouchableOpacity
                      onPress={() => openPostSafetyMenu(post)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={{ paddingHorizontal: 8, paddingVertical: 8 }}
                    >
                      <Text style={{ color: Colors.textMuted, fontSize: 18, fontWeight: '800' }}>⋯</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Workout name + stat chips */}
                <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                  <Text style={{ color: Colors.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.6, lineHeight: 23, marginBottom: 10 }}>
                    {post.workoutName}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {[
                      formatDuration(post.startedAt, post.endedAt),
                      `${post.setsCount} sets`,
                      fmtVolumeUnit(post.totalVolume, unit),
                    ].map((chip, i) => (
                      <View key={i} style={{
                        backgroundColor: Colors.surface2,
                        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                        borderWidth: 1, borderColor: Colors.border,
                      }}>
                        <Text style={{ color: Colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                          {chip}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Note */}
                {post.notes && (
                  <View style={{
                    marginHorizontal: 14, marginBottom: 10,
                    backgroundColor: Colors.bg,
                    borderRadius: 10, padding: 12,
                    borderLeftWidth: 3, borderLeftColor: Colors.accent + '55',
                    borderWidth: 1, borderColor: Colors.border,
                  }}>
                    <Text style={{ color: Colors.textSecondary, fontSize: 14, lineHeight: 21, fontStyle: 'italic' }}>
                      {post.notes}
                    </Text>
                  </View>
                )}

                {/* Exercise breakdown — full workout, every exercise and every set */}
                {post.exerciseSummaries.length > 0 && (
                  <View style={{
                    marginHorizontal: 14, marginBottom: 12,
                    backgroundColor: Colors.bg,
                    borderRadius: 12, overflow: 'hidden',
                    borderWidth: 1, borderColor: Colors.border,
                  }}>
                    {post.exerciseSummaries.map((ex, i) => (
                      <View key={i} style={{
                        paddingHorizontal: 12, paddingVertical: 10,
                        borderBottomWidth: i < post.exerciseSummaries.length - 1 ? 1 : 0,
                        borderBottomColor: Colors.border, gap: 8,
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{
                            width: 3, height: 20, borderRadius: 2,
                            backgroundColor: post.rankTierColor ?? Colors.accent, opacity: 0.55,
                          }} />
                          <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                            {ex.name}
                          </Text>
                          <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                            {ex.setCount} {ex.setCount === 1 ? 'set' : 'sets'}
                          </Text>
                        </View>
                        {ex.sets.length > 0 && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 13 }}>
                            {ex.sets.map((s, j) => (
                              <View key={j} style={{
                                backgroundColor: Colors.surface2, borderRadius: 6,
                                paddingHorizontal: 7, paddingVertical: 3,
                                borderWidth: 1, borderColor: Colors.border,
                              }}>
                                <Text style={{ color: Colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                                  {s.weight === 0 ? 'BW' : toDisplay(s.weight, unit)}×{s.reps}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* Actions */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 14, paddingVertical: 10,
                  borderTopWidth: 1, borderTopColor: Colors.border, gap: 4,
                }}>
                  <TouchableOpacity
                    onPress={() => toggleLike(post.workoutId, post.isLiked)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20,
                      backgroundColor: post.isLiked ? Colors.accent + '15' : 'transparent',
                      borderWidth: 1, borderColor: post.isLiked ? Colors.accent + '40' : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 15, color: post.isLiked ? Colors.accent : Colors.textMuted, fontWeight: '700' }}>
                      {post.isLiked ? '♥' : '♡'}
                    </Text>
                    {post.likeCount > 0 && (
                      <Text style={{ color: post.isLiked ? Colors.accent : Colors.textMuted, fontSize: 12, fontWeight: '800' }}>
                        {post.likeCount}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openComments(post.workoutId)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: Colors.textMuted }}>💬</Text>
                    {post.commentCount > 0 && (
                      <Text style={{ color: Colors.textMuted, fontSize: 12, fontWeight: '800' }}>
                        {post.commentCount}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Comment previews — latest comments shown right on the feed */}
                {post.previewComments.length > 0 && (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 6 }}>
                    {post.previewComments.map(c => (
                      <View key={c.id} style={{ flexDirection: 'row', gap: 6 }}>
                        <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '800' }}>
                          {c.displayName}
                        </Text>
                        <Text style={{ color: Colors.textSecondary, fontSize: 12, flex: 1, lineHeight: 17 }} numberOfLines={3}>
                          {c.content}
                        </Text>
                      </View>
                    ))}
                    {post.commentCount > post.previewComments.length && (
                      <TouchableOpacity onPress={() => openComments(post.workoutId)}>
                        <Text style={{ color: Colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                          View all {post.commentCount} comments
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
          />
        )
      )}

      {/* ── PEOPLE ─────────────────────────────────────────────────────────── */}
      {subTab === 'people' && (
        <FlashList
          data={loading ? [] : friends}
          keyExtractor={(f: Friend) => f.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.accent} />}
          ListHeaderComponent={
          <>
          {/* QR Scan button */}
          <TouchableOpacity
            onPress={openScanner}
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 14, padding: 16, marginBottom: 16,
              borderWidth: 1, borderColor: Colors.accent + '40',
              flexDirection: 'row', alignItems: 'center', gap: 14,
            }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: Colors.accentDim,
              borderWidth: 1, borderColor: Colors.accent + '40',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 22 }}>📷</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800' }}>Scan QR Code</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 1 }}>
                Scan a friend's profile QR to instantly add them
              </Text>
            </View>
            <Text style={{ color: Colors.accent, fontSize: 16 }}>›</Text>
          </TouchableOpacity>

          {/* Search */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search @username or name..."
              placeholderTextColor={Colors.textMuted}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              style={{
                flex: 1, backgroundColor: Colors.surface, borderColor: Colors.border,
                borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
                color: Colors.text, fontSize: 14,
              }}
            />
            <TouchableOpacity
              onPress={handleSearch}
              style={{ backgroundColor: Colors.accent, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' }}
            >
              {searching ? <ActivityIndicator color={Colors.text} size="small" /> : <Text style={{ color: Colors.text, fontWeight: '700' }}>Go</Text>}
            </TouchableOpacity>
          </View>

          {/* Search results */}
          {searchResults.length > 0 && (
            <View style={{ marginBottom: 20, gap: 8 }}>
              <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Results</Text>
              {searchResults.map((u: any) => (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => setSelectedFriendId(u.id)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    borderWidth: 1, borderColor: Colors.border,
                  }}>
                  <Avatar url={u.avatar_url} name={u.display_name} color={Colors.accent} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.text, fontWeight: '600' }}>{u.display_name}</Text>
                    {u.username && <Text style={{ color: Colors.accent, fontSize: 11, fontWeight: '700' }}>@{u.username}</Text>}
                    {u.bio && <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{u.bio}</Text>}
                  </View>
                  {u.alreadyFriend ? (
                    <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '700' }}>Friends ✓</Text>
                  ) : u.requestSent ? (
                    <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Sent</Text>
                  ) : (
                    <TouchableOpacity
                      onPress={() => sendRequest(u.id)}
                      style={{ backgroundColor: Colors.accentDim, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.accent + '40' }}
                    >
                      <Text style={{ color: Colors.accent, fontWeight: '700', fontSize: 12 }}>+ Add</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Pending requests */}
          {pending.length > 0 && (
            <View style={{ marginBottom: 20, gap: 8 }}>
              <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
                Requests ({pending.length})
              </Text>
              {pending.map(f => (
                <View key={f.friendshipId} style={{
                  backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  borderWidth: 1, borderColor: Colors.gold + '40',
                }}>
                  <Avatar url={f.avatar_url} name={f.display_name} color={Colors.gold} size={40} />
                  <Text style={{ color: Colors.text, fontWeight: '600', flex: 1 }}>{f.display_name}</Text>
                  <TouchableOpacity onPress={() => declineRequest(f.friendshipId)} style={{ borderRadius: 8, padding: 6, borderWidth: 1, borderColor: Colors.border }}>
                    <Text style={{ color: Colors.textMuted, fontSize: 12 }}>✕</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => acceptRequest(f.friendshipId)}
                    style={{ backgroundColor: Colors.goldDim, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.gold + '40' }}
                  >
                    <Text style={{ color: Colors.gold, fontWeight: '700', fontSize: 12 }}>Accept</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Suggested friends */}
          {!loading && friends.length > 0 && suggested.length > 0 && searchResults.length === 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                People You May Know
              </Text>
              {suggested.map((u: any) => (
                <View key={u.id} style={{
                  backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
                  marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12,
                  borderWidth: 1, borderColor: Colors.border,
                }}>
                  <Avatar url={u.avatar_url} name={u.display_name ?? '?'} color={Colors.textMuted} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.text, fontWeight: '600' }}>{u.display_name}</Text>
                    {u.username && <Text style={{ color: Colors.accent, fontSize: 11, fontWeight: '700' }}>@{u.username}</Text>}
                  </View>
                  <TouchableOpacity
                    onPress={() => sendRequest(u.id)}
                    style={{ backgroundColor: Colors.accentDim, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.accent + '40' }}
                  >
                    <Text style={{ color: Colors.accent, fontWeight: '700', fontSize: 12 }}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Friends list heading — the cards themselves are the list items */}
          {loading ? (
            <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
          ) : friends.length > 0 ? (
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
              Your Crew ({friends.length})
            </Text>
          ) : null}
          </>
          }
          renderItem={({ item: f }: { item: Friend }) => (
                <View
                  style={{
                    backgroundColor: Colors.surface,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: (f.rankTierColor ?? Colors.border) + '30',
                    overflow: 'hidden',
                    marginBottom: 10,
                  }}
                >
                  {/* Profile header */}
                  <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <Avatar url={f.avatar_url} name={f.display_name} color={f.rankTierColor ?? Colors.accent} size={56} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>
                          {f.display_name}
                        </Text>
                        <UserBadges isOwner={f.is_owner} isOg={f.is_og} isPro={f.is_pro} size="sm" />
                      </View>
                      {/* @username if exists */}
                      {(f as any).username && (
                        <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700', marginTop: 1 }}>
                          @{(f as any).username}
                        </Text>
                      )}
                      {/* Bio */}
                      {f.bio && (
                        <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 17 }} numberOfLines={2}>
                          {f.bio}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Tier bar */}
                  {f.rankTierLabel && (
                    <View style={{
                      marginHorizontal: 16, marginBottom: 12,
                      backgroundColor: (f.rankTierColor ?? Colors.accent) + '15',
                      borderRadius: 10, padding: 12,
                      borderWidth: 1, borderColor: (f.rankTierColor ?? Colors.accent) + '30',
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                    }}>
                      <View style={{
                        backgroundColor: (f.rankTierColor ?? Colors.accent) + '25',
                        borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
                      }}>
                        <Text style={{ color: f.rankTierColor ?? Colors.accent, fontWeight: '800', fontSize: 11, letterSpacing: 1.5 }}>
                          {f.rankTierLabel}
                        </Text>
                      </View>
                      {f.recentPR && (
                        <Text style={{ color: Colors.textMuted, fontSize: 11, flex: 1 }} numberOfLines={1}>
                          🏆 {f.recentPR.exerciseName} — {toDisplay(f.recentPR.weight, unit)} {unit}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Actions */}
                  <View style={{
                    flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border,
                  }}>
                    <TouchableOpacity
                      onPress={() => setSelectedFriendId(f.id)}
                      style={{
                        flex: 1, paddingVertical: 12, alignItems: 'center',
                        borderRightWidth: 1, borderRightColor: Colors.border,
                      }}
                    >
                      <Text style={{ color: Colors.accent, fontWeight: '700', fontSize: 13 }}>View Profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeFriend(f.friendshipId, f.display_name)}
                      style={{ paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center' }}
                    >
                      <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
          )}
        />
      )}

      {/* Comments Modal */}
      <Modal visible={!!commentWorkoutId} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: 20, paddingVertical: 16,
              borderBottomWidth: 1, borderBottomColor: Colors.border,
            }}>
              <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '800' }}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentWorkoutId(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: Colors.textMuted, fontSize: 18 }}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 14, flexGrow: 1 }}>
              {loadingComments ? (
                <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
              ) : comments.length === 0 ? (
                <Text style={{ color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 40 }}>
                  No comments yet. Be first.
                </Text>
              ) : (
                comments.map((c: any, i: number) => (
                  <View key={c.id ?? i} style={{ flexDirection: 'row', gap: 10 }}>
                    <Avatar
                      url={c.users?.avatar_url}
                      name={c.users?.display_name ?? '?'}
                      color={Colors.accent}
                      size={34}
                    />
                    <View style={{
                      flex: 1, backgroundColor: Colors.surface,
                      borderRadius: 12, padding: 12,
                      borderWidth: 1, borderColor: Colors.border,
                    }}>
                      <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>
                        {c.users?.display_name ?? 'Unknown'}
                      </Text>
                      <Text style={{ color: Colors.text, fontSize: 14, lineHeight: 20 }}>{c.content}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Comment input */}
            <View style={{
              flexDirection: 'row', alignItems: 'flex-end',
              paddingHorizontal: 16, paddingVertical: 12,
              borderTopWidth: 1, borderTopColor: Colors.border,
              backgroundColor: Colors.bg, gap: 10,
            }}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Add a comment..."
                placeholderTextColor={Colors.textMuted}
                multiline
                style={{
                  flex: 1, backgroundColor: Colors.surface2, borderRadius: 20,
                  paddingHorizontal: 16, paddingVertical: 10,
                  color: Colors.text, fontSize: 14, maxHeight: 100,
                  borderWidth: 1, borderColor: Colors.border,
                }}
              />
              <TouchableOpacity
                onPress={sendComment}
                disabled={!commentText.trim() || sendingComment}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: commentText.trim() ? Colors.accent : Colors.surface2,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {sendingComment
                  ? <ActivityIndicator color={Colors.text} size="small" />
                  : <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700' }}>↑</Text>
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Friend Profile Modal */}
      <FriendProfileModal
        visible={!!selectedFriendId}
        userId={selectedFriendId}
        onFriended={(f) => {
          // Optimistic: the new friend is in the list BEFORE the modal closes.
          // loadData() on close fills in rank/PR details in the background.
          setFriends(prev => [
            {
              id: f.id, friendshipId: f.friendshipId,
              display_name: f.display_name, avatar_url: f.avatar_url,
              bio: f.bio, bodyweight_lbs: f.bodyweight_lbs,
              is_owner: f.is_owner, is_og: f.is_og, is_pro: f.is_pro,
            },
            ...prev.filter(x => x.id !== f.id),
          ]);
        }}
        onClose={() => {
          setSelectedFriendId(null);
          // A friendship may have just been created (creator auto-accepts) —
          // refresh so feed posts + rank details land right behind the optimistic row
          loadData();
        }}
      />

      {/* QR Scanner Modal */}
      <Modal visible={showScanner} animationType="slide" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* Full screen camera */}
          <CameraView
            onBarcodeScanned={({ data }) => handleQRScan({ data })}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            style={{ flex: 1 }}
          />

          {/* Overlay — sits on top of camera */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Darken edges */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />

            {/* Scan window */}
            <View style={{
              width: 260, height: 260,
              borderRadius: 20,
              borderWidth: 2,
              borderColor: Colors.accent,
              backgroundColor: 'transparent',
              zIndex: 2,
              shadowColor: Colors.accent,
              shadowOpacity: 0.6,
              shadowRadius: 20,
            }} />

            {/* Label */}
            <Text style={{
              color: Colors.text, fontSize: 14, fontWeight: '600',
              marginTop: 24, zIndex: 2, textAlign: 'center',
            }}>
              Point at a friend's STR QR code
            </Text>
          </View>

          {/* Close button — fixed at bottom, always visible */}
          <SafeAreaView style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            alignItems: 'center', paddingBottom: 32,
          }} edges={['bottom']}>
            <TouchableOpacity
              onPress={() => setShowScanner(false)}
              style={{
                backgroundColor: Colors.surface,
                borderRadius: 50, paddingHorizontal: 32, paddingVertical: 16,
                borderWidth: 1, borderColor: Colors.border,
              }}
            >
              <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
