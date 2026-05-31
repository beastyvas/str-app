import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors, TierName } from '@/constants/colors';
import { getAnimeTierResult, ANIME_TIERS } from '@/constants/animeTiers';
import * as Haptics from 'expo-haptics';

interface Friend {
  id: string;
  display_name: string;
  bodyweight_lbs?: number;
  friendshipId: string;
  animeTierLabel?: string;
  animeTierColor?: string;
  recentPR?: { exerciseName: string; weight: number; reps: number; achieved_at: string };
}

interface PendingRequest {
  id: string;
  friendshipId: string;
  display_name: string;
  avatar_url?: string;
}

interface SearchResult {
  id: string;
  display_name: string;
  bodyweight_lbs?: number;
  alreadyFriend: boolean;
  requestSent: boolean;
}

export default function FriendsScreen() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFriends = useCallback(async () => {
    if (!user) return;
    try {
      // Get all friendships
      const { data: friendships } = await supabase
        .from('friendships')
        .select(`
          id, status, requester_id, addressee_id,
          requester:users!friendships_requester_id_fkey(id, display_name, bodyweight_lbs),
          addressee:users!friendships_addressee_id_fkey(id, display_name, bodyweight_lbs)
        `)
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (!friendships) return;

      const accepted = friendships.filter(f => f.status === 'accepted');
      const incomingPending = friendships.filter(f => f.status === 'pending' && f.addressee_id === user.id);

      // Build friends list with tiers
      const friendList: Friend[] = await Promise.all(
        accepted.map(async f => {
          const other = f.requester_id === user.id ? (f.addressee as any) : (f.requester as any);

          // Get their SBD PRs to calculate tier
          const { data: prs } = await supabase
            .from('personal_records')
            .select('weight, reps, achieved_at, exercises!inner(name)')
            .eq('user_id', other.id)
            .in('exercises.name', ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts'])
            .order('achieved_at', { ascending: false });

          // Get their most recent PR (any exercise)
          const { data: recentPRs } = await supabase
            .from('personal_records')
            .select('weight, reps, achieved_at, exercises(name)')
            .eq('user_id', other.id)
            .order('achieved_at', { ascending: false })
            .limit(1);

          const sbdPrs = (prs ?? []).map((p: any) => ({
            exerciseName: p.exercises?.name ?? '',
            weight: p.weight,
            reps: p.reps,
          }));

          const tierResult = getAnimeTierResult(sbdPrs, other.bodyweight_lbs ?? 185);
          const recentPR = recentPRs?.[0];

          return {
            id: other.id,
            display_name: other.display_name ?? 'Unknown',
            bodyweight_lbs: other.bodyweight_lbs,
            friendshipId: f.id,
            animeTierLabel: tierResult.animeTier.label,
            animeTierColor: tierResult.animeTier.color,
            recentPR: recentPR ? {
              exerciseName: (recentPR as any).exercises?.name ?? '',
              weight: recentPR.weight,
              reps: recentPR.reps,
              achieved_at: recentPR.achieved_at,
            } : undefined,
          };
        })
      );

      setFriends(friendList);
      setPending(
        incomingPending.map(f => ({
          id: (f.requester as any).id,
          friendshipId: f.id,
          display_name: (f.requester as any).display_name ?? 'Unknown',
        }))
      );
    } catch (e) {
      // silence
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  const handleSearch = async () => {
    if (!search.trim() || !user) return;
    setSearching(true);
    try {
      const { data: users } = await supabase
        .from('users')
        .select('id, display_name, bodyweight_lbs')
        .ilike('display_name', `%${search.trim()}%`)
        .neq('id', user.id)
        .limit(10);

      // Check which ones are already friends or have pending requests
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

      setSearchResults((users ?? []).map(u => ({
        id: u.id,
        display_name: u.display_name ?? 'Unknown',
        bodyweight_lbs: u.bodyweight_lbs,
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
    loadFriends();
  };

  const declineRequest = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    setPending(prev => prev.filter(p => p.friendshipId !== friendshipId));
  };

  const removeFriend = (friendshipId: string, name: string) => {
    Alert.alert(
      'Remove friend',
      `Remove ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('friendships').delete().eq('id', friendshipId);
            setFriends(prev => prev.filter(f => f.friendshipId !== friendshipId));
          },
        },
      ]
    );
  };

  const timeAgo = (iso: string) => {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (d === 0) return 'today';
    if (d === 1) return 'yesterday';
    return `${d}d ago`;
  };

  const initials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFriends(); }} tintColor={Colors.accent} />}
      >
        {/* Header */}
        <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -1, marginBottom: 20 }}>
          Friends
        </Text>

        {/* Search */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by display name..."
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            style={{
              flex: 1,
              backgroundColor: Colors.surface,
              borderColor: Colors.border,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: Colors.text,
              fontSize: 14,
            }}
          />
          <TouchableOpacity
            onPress={handleSearch}
            style={{
              backgroundColor: Colors.accent,
              borderRadius: 12,
              paddingHorizontal: 16,
              justifyContent: 'center',
            }}
          >
            {searching
              ? <ActivityIndicator color={Colors.text} size="small" />
              : <Text style={{ color: Colors.text, fontWeight: '700' }}>Search</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
              Results
            </Text>
            {searchResults.map(u => (
              <View key={u.id} style={{
                backgroundColor: Colors.surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: Colors.border,
              }}>
                {/* Avatar */}
                <View style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: Colors.accentDim,
                  borderWidth: 1,
                  borderColor: Colors.accent + '40',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{ color: Colors.accent, fontWeight: '800', fontSize: 14 }}>
                    {initials(u.display_name)}
                  </Text>
                </View>
                <Text style={{ color: Colors.text, fontWeight: '600', flex: 1 }}>{u.display_name}</Text>
                {u.alreadyFriend ? (
                  <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '700' }}>Friends</Text>
                ) : u.requestSent ? (
                  <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Sent</Text>
                ) : (
                  <TouchableOpacity
                    onPress={() => sendRequest(u.id)}
                    style={{
                      backgroundColor: Colors.accentDim,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderWidth: 1,
                      borderColor: Colors.accent + '40',
                    }}
                  >
                    <Text style={{ color: Colors.accent, fontWeight: '700', fontSize: 12 }}>+ Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Pending Requests */}
        {pending.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
              Requests ({pending.length})
            </Text>
            {pending.map(f => (
              <View key={f.friendshipId} style={{
                backgroundColor: Colors.surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: Colors.gold + '40',
              }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: Colors.goldDim,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: Colors.gold, fontWeight: '800', fontSize: 14 }}>
                    {initials(f.display_name)}
                  </Text>
                </View>
                <Text style={{ color: Colors.text, fontWeight: '600', flex: 1 }}>{f.display_name}</Text>
                <TouchableOpacity
                  onPress={() => declineRequest(f.friendshipId)}
                  style={{
                    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
                    borderWidth: 1, borderColor: Colors.border,
                  }}
                >
                  <Text style={{ color: Colors.textMuted, fontSize: 12 }}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => acceptRequest(f.friendshipId)}
                  style={{
                    backgroundColor: Colors.goldDim,
                    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
                    borderWidth: 1, borderColor: Colors.gold + '40',
                  }}
                >
                  <Text style={{ color: Colors.gold, fontWeight: '700', fontSize: 12 }}>Accept</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Friends List */}
        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
        ) : friends.length === 0 && pending.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 40, gap: 8 }}>
            <Text style={{ color: Colors.textMuted, fontSize: 15 }}>No friends yet.</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Search above to find people.</Text>
          </View>
        ) : (
          <View>
            {friends.length > 0 && (
              <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                Your crew ({friends.length})
              </Text>
            )}
            {friends.map(f => (
              <TouchableOpacity
                key={f.id}
                onLongPress={() => removeFriend(f.friendshipId, f.display_name)}
                delayLongPress={600}
                activeOpacity={0.8}
                style={{
                  backgroundColor: Colors.surface,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {/* Avatar */}
                  <View style={{
                    width: 46, height: 46, borderRadius: 23,
                    backgroundColor: (f.animeTierColor ?? Colors.accent) + '20',
                    borderWidth: 2,
                    borderColor: (f.animeTierColor ?? Colors.accent) + '60',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ color: f.animeTierColor ?? Colors.accent, fontWeight: '900', fontSize: 16 }}>
                      {initials(f.display_name)}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 2 }}>
                      {f.display_name}
                    </Text>
                    {f.animeTierLabel && (
                      <View style={{
                        alignSelf: 'flex-start',
                        backgroundColor: (f.animeTierColor ?? Colors.accent) + '18',
                        borderRadius: 5,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        marginBottom: 4,
                      }}>
                        <Text style={{
                          color: f.animeTierColor ?? Colors.accent,
                          fontSize: 9, fontWeight: '900', letterSpacing: 1.5,
                        }}>
                          {f.animeTierLabel}
                        </Text>
                      </View>
                    )}
                    {f.recentPR && (
                      <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                        🏆 {f.recentPR.exerciseName} {f.recentPR.weight} lbs · {timeAgo(f.recentPR.achieved_at)}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            {friends.length > 0 && (
              <Text style={{ color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                Long press a friend to remove
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
