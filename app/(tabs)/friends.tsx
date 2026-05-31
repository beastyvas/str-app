import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, RefreshControl, Image, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, Camera } from 'expo-camera';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/colors';
import { getAnimeTierResult } from '@/constants/animeTiers';
import { FriendProfileModal } from '@/components/FriendProfileModal';

type SubTab = 'feed' | 'people';

interface ExerciseSummary {
  name: string;
  setCount: number;
  topWeight: number;
  topReps: number;
}

interface FeedPost {
  workoutId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  workoutName: string;
  startedAt: string;
  endedAt: string;
  notes?: string;
  setsCount: number;
  totalVolume: number;
  exercises: string[];
  exerciseSummaries: ExerciseSummary[];
  animeTierLabel?: string;
  animeTierColor?: string;
  photoUrl?: string;
  likeCount: number;
  isLiked: boolean;
  commentCount: number;
}

interface Friend {
  id: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  bodyweight_lbs?: number;
  friendshipId: string;
  animeTierLabel?: string;
  animeTierColor?: string;
  recentPR?: { exerciseName: string; weight: number; achieved_at: string };
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
        ? <Image source={{ uri: url }} style={{ width: size, height: size }} />
        : <Text style={{ color, fontWeight: '900', fontSize: size * 0.3 }}>{initials}</Text>
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

function formatDuration(start: string, end: string) {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function SocialScreen() {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>('feed');
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
      // Load friendships
      const { data: friendships } = await supabase
        .from('friendships')
        .select(`
          id, status, requester_id, addressee_id,
          requester:users!friendships_requester_id_fkey(id, display_name, avatar_url, bio, bodyweight_lbs),
          addressee:users!friendships_addressee_id_fkey(id, display_name, avatar_url, bio, bodyweight_lbs)
        `)
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      console.log('[Friends] total friendships:', friendships?.length ?? 0);
      const accepted = (friendships ?? []).filter(f => f.status === 'accepted');
      const incoming = (friendships ?? []).filter(f => f.status === 'pending' && f.addressee_id === user.id);
      const friendIds = accepted.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
      console.log('[Friends] accepted:', accepted.length, 'friendIds:', friendIds);

      setPending(incoming.map(f => ({
        id: (f.requester as any).id,
        friendshipId: f.id,
        display_name: (f.requester as any).display_name ?? 'Unknown',
        avatar_url: (f.requester as any).avatar_url,
      })));

      // ── Batch all friend PRs FIRST so sbdByUser is available for feed + friendList ──
      const sbdByUser: Record<string, any[]> = {};
      const recentByUser: Record<string, any> = {};
      if (friendIds.length > 0) {
        const [{ data: allSbdPrs }, { data: allRecentPrs }] = await Promise.all([
          supabase.from('personal_records').select('user_id, weight, reps, exercises!inner(name)')
            .in('user_id', friendIds)
            .in('exercises.name', ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts']),
          supabase.from('personal_records').select('user_id, weight, reps, achieved_at, exercises(name)')
            .in('user_id', friendIds)
            .order('achieved_at', { ascending: false }),
        ]);
        (allSbdPrs ?? []).forEach((p: any) => {
          if (!sbdByUser[p.user_id]) sbdByUser[p.user_id] = [];
          sbdByUser[p.user_id].push(p);
        });
        (allRecentPrs ?? []).forEach((p: any) => {
          if (!recentByUser[p.user_id]) recentByUser[p.user_id] = p;
        });
      }

      // Load feed — your workouts + friends' workouts
      const feedUserIds = [user.id, ...friendIds];
      if (feedUserIds.length > 0) {
        // Wrap feed separately so errors don't kill the friends list
        const { data: workouts, error: feedErr } = await supabase
          .from('workouts')
          .select(`
            id, user_id, name, started_at, ended_at, notes,
            workout_sets(weight, reps, set_number, exercises(name))
          `)
          .in('user_id', feedUserIds)
          .not('ended_at', 'is', null)
          .order('ended_at', { ascending: false })
          .limit(30);

        if (feedErr) {
          console.log('[Feed] error (non-fatal):', feedErr.message);
        }

        // Filter out imported workouts client-side (is_imported might not exist yet)
        const posts: FeedPost[] = (workouts ?? [])
          .filter((w: any) => !w.is_imported)
          .map((w: any) => {
            // If it's your own workout, use your profile
            const isOwn = w.user_id === user.id;
            const friendship = !isOwn ? accepted.find(f =>
              f.requester_id === w.user_id || f.addressee_id === w.user_id
            ) : null;
            const other = isOwn
              ? { display_name: profile?.display_name, avatar_url: profile?.avatar_url, bodyweight_lbs: profile?.bodyweight_lbs }
              : friendship
                ? (friendship.requester_id === w.user_id ? friendship.requester : friendship.addressee) as any
                : null;
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
              return { name, setCount: data.sets.length, topWeight: topSet?.weight ?? 0, topReps: topSet?.reps ?? 0 };
            });

            return {
              workoutId: w.id,
              userId: w.user_id,
              displayName: other?.display_name ?? 'Unknown',
              avatarUrl: other?.avatar_url,
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
              animeTierLabel: (sbdByUser[w.user_id] ?? []).length > 0
                ? getAnimeTierResult((sbdByUser[w.user_id] ?? []).map((p: any) => ({
                    exerciseName: p.exercises?.name ?? '', weight: p.weight, reps: p.reps,
                  })), other?.bodyweight_lbs ?? 185).animeTier.label
                : undefined,
              animeTierColor: (sbdByUser[w.user_id] ?? []).length > 0
                ? getAnimeTierResult((sbdByUser[w.user_id] ?? []).map((p: any) => ({
                    exerciseName: p.exercises?.name ?? '', weight: p.weight, reps: p.reps,
                  })), other?.bodyweight_lbs ?? 185).animeTier.color
                : undefined,
            };
          });
        // Enrich with likes, comments, photos
        if (posts.length > 0) {
          const workoutIds = posts.map(p => p.workoutId);
          const [{ data: likesData }, { data: commentsData }, { data: photosData }] = await Promise.all([
            supabase.from('workout_likes').select('workout_id, user_id').in('workout_id', workoutIds),
            supabase.from('workout_comments').select('workout_id').in('workout_id', workoutIds),
            supabase.from('workout_photos').select('workout_id, photo_url').in('workout_id', workoutIds),
          ]);
          const myId = user!.id;
          const enriched = posts.map(p => ({
            ...p,
            likeCount: (likesData ?? []).filter((l: any) => l.workout_id === p.workoutId).length,
            isLiked: (likesData ?? []).some((l: any) => l.workout_id === p.workoutId && l.user_id === myId),
            commentCount: (commentsData ?? []).filter((c: any) => c.workout_id === p.workoutId).length,
            photoUrl: (photosData ?? []).find((ph: any) => ph.workout_id === p.workoutId)?.photo_url,
          }));
          setFeed(enriched);
        } else {
          setFeed(posts);
        }
      }

      const friendList: Friend[] = accepted
        .map(f => {
        const other = (f.requester_id === user.id ? f.addressee : f.requester) as any;
        if (!other?.id) {
          console.log('[Friends] null other for friendship:', f.id, '— RLS may be blocking user join');
          return null;
        }
        const sbdPrs = (sbdByUser[other.id] ?? []).map((p: any) => ({
          exerciseName: p.exercises?.name ?? '',
          weight: p.weight, reps: p.reps,
        }));
        const tierResult = getAnimeTierResult(sbdPrs, other.bodyweight_lbs ?? 185);
        const pr = recentByUser[other.id];
        return {
          id: other.id,
          display_name: other.display_name ?? 'Unknown',
          avatar_url: other.avatar_url,
          bio: other.bio,
          bodyweight_lbs: other.bodyweight_lbs,
          friendshipId: f.id,
          animeTierLabel: tierResult.animeTier.label,
          animeTierColor: tierResult.animeTier.color,
          recentPR: pr ? {
            exerciseName: pr.exercises?.name ?? '',
            weight: pr.weight,
            achieved_at: pr.achieved_at,
          } : undefined,
        };
      })
      .filter(Boolean) as Friend[];
      console.log('[Friends] built friendList:', friendList.length);
      setFriends(friendList);
    } catch (e) {
      // silence
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSearch = async () => {
    if (!search.trim() || !user) return;
    setSearching(true);
    try {
      const q = search.trim().replace(/^@/, '');
      const { data: users, error: searchError } = await supabase
        .from('users')
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
    await supabase.from('friendships').insert({ requester_id: user?.id, addressee_id: toId });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchResults(prev => prev.map(u => u.id === toId ? { ...u, requestSent: true } : u));
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
      .select('id, content, created_at, users(display_name, avatar_url)')
      .eq('workout_id', workoutId)
      .order('created_at', { ascending: true });
    setComments(data ?? []);
    setLoadingComments(false);
  };

  const sendComment = async () => {
    if (!commentText.trim() || !user || !commentWorkoutId) return;
    setSendingComment(true);
    const { data } = await supabase
      .from('workout_comments')
      .insert({ workout_id: commentWorkoutId, user_id: user.id, content: commentText.trim() })
      .select('id, content, created_at, users(display_name, avatar_url)')
      .single();
    if (data) {
      setComments(prev => [...prev, data]);
      setFeed(prev => prev.map(p => p.workoutId === commentWorkoutId
        ? { ...p, commentCount: p.commentCount + 1 }
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
      .from('users')
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
      .from('users')
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
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 0,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
      }}>
        <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -1, marginBottom: 12 }}>
          Social
        </Text>
        <View style={{ flexDirection: 'row' }}>
          {([
            { key: 'feed' as SubTab, label: 'Feed' },
            { key: 'people' as SubTab, label: `Friends${friends.length > 0 ? ` (${friends.length})` : ''}` },
          ]).map(t => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setSubTab(t.key)}
              style={{
                paddingHorizontal: 16, paddingVertical: 10, marginRight: 4,
                borderBottomWidth: 2,
                borderBottomColor: subTab === t.key ? Colors.accent : 'transparent',
              }}
            >
              <Text style={{
                color: subTab === t.key ? Colors.text : Colors.textMuted,
                fontSize: 13, fontWeight: subTab === t.key ? '700' : '500',
              }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── FEED ──────────────────────────────────────────────────────────── */}
      {subTab === 'feed' && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.accent} />}
        >
          {loading ? (
            <ActivityIndicator color={Colors.accent} style={{ marginTop: 60 }} />
          ) : friends.length === 0 ? (
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
          ) : feed.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 80, gap: 8 }}>
              <Text style={{ color: Colors.textMuted, fontSize: 20 }}>🏋️</Text>
              <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700' }}>No workouts yet</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                When your friends finish a workout it shows here. Get them lifting.
              </Text>
            </View>
          ) : (
            feed.map(post => (
              <View key={post.workoutId} style={{
                backgroundColor: Colors.surface,
                borderRadius: 18,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: Colors.border,
                overflow: 'hidden',
              }}>
                {/* Post header — tap to view profile */}
                <TouchableOpacity
                  onPress={() => setSelectedFriendId(post.userId)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    padding: 14,
                  }}
                >
                  <Avatar url={post.avatarUrl} name={post.displayName} color={post.animeTierColor ?? Colors.accent} size={44} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>
                        {post.displayName}
                      </Text>
                      {post.animeTierLabel && (
                        <View style={{
                          backgroundColor: (post.animeTierColor ?? Colors.accent) + '20',
                          borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
                        }}>
                          <Text style={{ color: post.animeTierColor ?? Colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.5 }}>
                            {post.animeTierLabel}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>
                      {timeAgo(post.endedAt)}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Photo — full width hero */}
                {post.photoUrl && (
                  <Image source={{ uri: post.photoUrl }} style={{ width: '100%', height: 240 }} resizeMode="cover" />
                )}

                {/* Caption / note */}
                {post.notes && (
                  <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
                    <Text style={{ color: Colors.text, fontSize: 15, lineHeight: 22 }}>
                      {post.notes}
                    </Text>
                  </View>
                )}

                {/* Workout breakdown — what they actually did */}
                {post.exerciseSummaries.length > 0 && (
                  <View style={{
                    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
                    backgroundColor: Colors.surface2,
                    borderRadius: 12, overflow: 'hidden',
                    borderWidth: 1, borderColor: Colors.border,
                  }}>
                    {post.exerciseSummaries.slice(0, 4).map((ex, i) => (
                      <View key={i} style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 14, paddingVertical: 9,
                        borderBottomWidth: i < Math.min(post.exerciseSummaries.length, 4) - 1 ? 1 : 0,
                        borderBottomColor: Colors.border,
                      }}>
                        <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                          {ex.name}
                        </Text>
                        <Text style={{ color: Colors.textMuted, fontSize: 11, marginRight: 10 }}>
                          {ex.setCount} set{ex.setCount !== 1 ? 's' : ''}
                        </Text>
                        {ex.topWeight > 0 && (
                          <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700' }}>
                            {ex.topWeight === 0 ? `BW×${ex.topReps}` : `${ex.topWeight}×${ex.topReps}`}
                          </Text>
                        )}
                      </View>
                    ))}
                    {post.exerciseSummaries.length > 4 && (
                      <View style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
                        <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                          +{post.exerciseSummaries.length - 4} more exercises
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Stats + Like + Comment */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 16, paddingVertical: 12,
                  marginTop: 4,
                  borderTopWidth: 1, borderTopColor: Colors.border,
                  gap: 16,
                }}>
                  <TouchableOpacity
                    onPress={() => toggleLike(post.workoutId, post.isLiked)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                  >
                    <Text style={{ fontSize: 20 }}>{post.isLiked ? '❤️' : '🤍'}</Text>
                    {post.likeCount > 0 && (
                      <Text style={{ color: post.isLiked ? Colors.accent : Colors.textMuted, fontSize: 13, fontWeight: '700' }}>
                        {post.likeCount}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openComments(post.workoutId)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                  >
                    <Text style={{ fontSize: 18 }}>💬</Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 13, fontWeight: '700' }}>
                      {post.commentCount > 0 ? post.commentCount : ''}
                    </Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                  <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                    {formatDuration(post.startedAt, post.endedAt)} · {formatVolume(post.totalVolume)} lbs
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ── PEOPLE ─────────────────────────────────────────────────────────── */}
      {subTab === 'people' && (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.accent} />}
        >
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

          {/* Friends list */}
          {loading ? (
            <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
          ) : friends.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
                Your Crew ({friends.length})
              </Text>
              {friends.map(f => (
                <View
                  key={f.id}
                  style={{
                    backgroundColor: Colors.surface,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: (f.animeTierColor ?? Colors.border) + '30',
                    overflow: 'hidden',
                  }}
                >
                  {/* Profile header */}
                  <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <Avatar url={f.avatar_url} name={f.display_name} color={f.animeTierColor ?? Colors.accent} size={56} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 }}>
                        {f.display_name}
                      </Text>
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
                  {f.animeTierLabel && (
                    <View style={{
                      marginHorizontal: 16, marginBottom: 12,
                      backgroundColor: (f.animeTierColor ?? Colors.accent) + '15',
                      borderRadius: 10, padding: 12,
                      borderWidth: 1, borderColor: (f.animeTierColor ?? Colors.accent) + '30',
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                    }}>
                      <View style={{
                        backgroundColor: (f.animeTierColor ?? Colors.accent) + '25',
                        borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
                      }}>
                        <Text style={{ color: f.animeTierColor ?? Colors.accent, fontWeight: '900', fontSize: 11, letterSpacing: 1.5 }}>
                          {f.animeTierLabel}
                        </Text>
                      </View>
                      {f.recentPR && (
                        <Text style={{ color: Colors.textMuted, fontSize: 11, flex: 1 }} numberOfLines={1}>
                          🏆 {f.recentPR.exerciseName} — {f.recentPR.weight} lbs
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
              ))}
            </View>
          )}
        </ScrollView>
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
        onClose={() => setSelectedFriendId(null)}
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
