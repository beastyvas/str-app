import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, RefreshControl, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, Camera } from 'expo-camera';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/colors';
import { getAnimeTierResult } from '@/constants/animeTiers';
import * as Haptics from 'expo-haptics';
import { FriendProfileModal } from '@/components/FriendProfileModal';

type SubTab = 'feed' | 'people';

interface FeedPost {
  workoutId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  workoutName: string;
  startedAt: string;
  endedAt: string;
  notes: string;
  setsCount: number;
  totalVolume: number;
  exercises: string[];
  animeTierLabel?: string;
  animeTierColor?: string;
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
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
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
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

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

      // Load feed — friends' completed workouts with notes
      if (friendIds.length > 0) {
        const { data: workouts } = await supabase
          .from('workouts')
          .select(`
            id, user_id, name, started_at, ended_at, notes,
            workout_sets(weight, reps, exercises(name))
          `)
          .in('user_id', friendIds)
          .not('ended_at', 'is', null)
          .not('notes', 'is', null)
          .order('ended_at', { ascending: false })
          .limit(30);

        const posts: FeedPost[] = (workouts ?? [])
          .filter((w: any) => w.notes?.trim())
          .map((w: any) => {
            const friendship = accepted.find(f =>
              f.requester_id === w.user_id || f.addressee_id === w.user_id
            );
            const other = friendship
              ? (friendship.requester_id === w.user_id ? friendship.requester : friendship.addressee) as any
              : null;
            const sets = w.workout_sets ?? [];
            const vol = sets.reduce((s: number, x: any) => s + x.weight * x.reps, 0);
            const exs = [...new Set(sets.map((s: any) => s.exercises?.name).filter(Boolean))] as string[];
            return {
              workoutId: w.id,
              userId: w.user_id,
              displayName: other?.display_name ?? 'Unknown',
              avatarUrl: other?.avatar_url,
              workoutName: w.name,
              startedAt: w.started_at,
              endedAt: w.ended_at,
              notes: w.notes,
              setsCount: sets.length,
              totalVolume: vol,
              exercises: exs,
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
        setFeed(posts);
      }

      // Batch all friend PRs in TWO queries (not N)
      const friendUserIds = accepted.map(f =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      );

      const [{ data: allSbdPrs }, { data: allRecentPrs }] = await Promise.all([
        supabase
          .from('personal_records')
          .select('user_id, weight, reps, exercises!inner(name)')
          .in('user_id', friendUserIds)
          .in('exercises.name', ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts']),
        supabase
          .from('personal_records')
          .select('user_id, weight, reps, achieved_at, exercises(name)')
          .in('user_id', friendUserIds)
          .order('achieved_at', { ascending: false }),
      ]);

      // Group by user_id
      const sbdByUser: Record<string, any[]> = {};
      const recentByUser: Record<string, any> = {};
      (allSbdPrs ?? []).forEach((p: any) => {
        if (!sbdByUser[p.user_id]) sbdByUser[p.user_id] = [];
        sbdByUser[p.user_id].push(p);
      });
      (allRecentPrs ?? []).forEach((p: any) => {
        if (!recentByUser[p.user_id]) recentByUser[p.user_id] = p;
      });

      const friendList: Friend[] = accepted.map(f => {
        const other = (f.requester_id === user.id ? f.addressee : f.requester) as any;
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
      });
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

  const openScanner = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status === 'granted') setShowScanner(true);
    else Alert.alert('Camera permission needed to scan QR codes');
  };

  const handleQRScan = async ({ data }: { data: string }) => {
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
              <Text style={{ color: Colors.textMuted, fontSize: 20 }}>📝</Text>
              <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700' }}>Nothing in the feed yet</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                Friends' workouts show here when they add a session note after finishing.
              </Text>
            </View>
          ) : (
            feed.map(post => (
              <TouchableOpacity key={post.workoutId} onPress={() => setSelectedFriendId(post.userId)} activeOpacity={0.9} style={{
                backgroundColor: Colors.surface,
                borderRadius: 16,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: Colors.border,
                overflow: 'hidden',
              }}>
                {/* Post header */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
                }}>
                  <Avatar
                    url={post.avatarUrl}
                    name={post.displayName}
                    color={Colors.accent}
                    size={40}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>
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
                    <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                      {post.workoutName} · {timeAgo(post.endedAt)}
                    </Text>
                  </View>
                </View>

                {/* Session note — the "post" */}
                <View style={{ padding: 14, paddingBottom: 10 }}>
                  <Text style={{ color: Colors.text, fontSize: 15, lineHeight: 22 }}>
                    {post.notes}
                  </Text>
                </View>

                {/* Workout stats */}
                <View style={{
                  flexDirection: 'row', gap: 16, paddingHorizontal: 14, paddingBottom: 12,
                }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                    {formatDuration(post.startedAt, post.endedAt)}
                  </Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                    {post.setsCount} sets
                  </Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                    {formatVolume(post.totalVolume)} lbs
                  </Text>
                </View>

                {/* Exercises */}
                {post.exercises.length > 0 && (
                  <View style={{
                    paddingHorizontal: 14, paddingBottom: 14,
                    flexDirection: 'row', flexWrap: 'wrap', gap: 5,
                  }}>
                    {post.exercises.map((ex, i) => (
                      <View key={i} style={{
                        backgroundColor: Colors.surface2, borderRadius: 5,
                        paddingHorizontal: 7, paddingVertical: 3,
                      }}>
                        <Text style={{ color: Colors.textMuted, fontSize: 10 }}>{ex}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
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
                <View key={u.id} style={{
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
                </View>
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
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setSelectedFriendId(f.id)}
                  onLongPress={() => removeFriend(f.friendshipId, f.display_name)}
                  delayLongPress={600}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
                    borderWidth: 1, borderColor: Colors.border,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                  }}
                >
                  <Avatar url={f.avatar_url} name={f.display_name} color={f.animeTierColor ?? Colors.accent} size={46} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 2 }}>{f.display_name}</Text>
                    {f.bio && (
                      <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 4 }} numberOfLines={1}>{f.bio}</Text>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {f.animeTierLabel && (
                        <View style={{
                          backgroundColor: (f.animeTierColor ?? Colors.accent) + '18',
                          borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
                        }}>
                          <Text style={{ color: f.animeTierColor ?? Colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }}>
                            {f.animeTierLabel}
                          </Text>
                        </View>
                      )}
                      {f.recentPR && (
                        <Text style={{ color: Colors.textMuted, fontSize: 10 }}>
                          🏆 {f.recentPR.exerciseName} {f.recentPR.weight} lbs · {timeAgo(f.recentPR.achieved_at)}
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              <Text style={{ color: Colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 4 }}>
                Long press to remove a friend
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Friend Profile Modal */}
      <FriendProfileModal
        visible={!!selectedFriendId}
        userId={selectedFriendId}
        onClose={() => setSelectedFriendId(null)}
      />

      {/* QR Scanner Modal */}
      <Modal visible={showScanner} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
            <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '900' }}>Scan QR Code</Text>
            <TouchableOpacity onPress={() => setShowScanner(false)}>
              <Text style={{ color: Colors.accent, fontWeight: '700', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <CameraView
            onBarcodeScanned={({ data }) => handleQRScan({ data })}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            style={{ flex: 1 }}
          />
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center' }}>
              Point your camera at a friend's STR QR code
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
