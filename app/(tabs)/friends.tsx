import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/colors';
import * as Haptics from 'expo-haptics';

export default function FriendsScreen() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => { loadFriends(); }, []);

  const loadFriends = async () => {
    const { data } = await supabase
      .from('friendships')
      .select(`
        *,
        requester:users!friendships_requester_id_fkey ( id, display_name, avatar_url ),
        addressee:users!friendships_addressee_id_fkey ( id, display_name, avatar_url )
      `)
      .or(`requester_id.eq.${user?.id},addressee_id.eq.${user?.id}`);

    if (data) {
      const accepted = data.filter(f => f.status === 'accepted');
      const pendingIn = data.filter(f => f.status === 'pending' && f.addressee_id === user?.id);
      setFriends(accepted.map(f => f.requester_id === user?.id ? f.addressee : f.requester));
      setPending(pendingIn.map(f => ({ ...f.requester, friendshipId: f.id })));
    }
  };

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .ilike('display_name', `%${search}%`)
      .neq('id', user?.id)
      .limit(10);
    setSearchResults(data ?? []);
    setSearching(false);
  };

  const sendRequest = async (toId: string) => {
    await supabase.from('friendships').insert({ requester_id: user?.id, addressee_id: toId });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Request sent!');
    setSearchResults([]);
    setSearch('');
  };

  const acceptRequest = async (friendshipId: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadFriends();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
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
              borderRadius: 10,
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
              borderRadius: 10,
              paddingHorizontal: 16,
              justifyContent: 'center',
            }}
          >
            {searching ? <ActivityIndicator color={Colors.text} size="small" /> : (
              <Text style={{ color: Colors.text, fontWeight: '700' }}>Go</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
              Results
            </Text>
            {searchResults.map(u => (
              <View key={u.id} style={{
                backgroundColor: Colors.surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 8,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: Colors.border,
              }}>
                <Text style={{ color: Colors.text, fontWeight: '600' }}>{u.display_name}</Text>
                <TouchableOpacity
                  onPress={() => sendRequest(u.id)}
                  style={{ backgroundColor: Colors.accentDim, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ color: Colors.accent, fontWeight: '700', fontSize: 12 }}>Add</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Pending Requests */}
        {pending.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
              Requests ({pending.length})
            </Text>
            {pending.map(f => (
              <View key={f.friendshipId} style={{
                backgroundColor: Colors.surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 8,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: Colors.gold,
              }}>
                <Text style={{ color: Colors.text, fontWeight: '600' }}>{f.display_name}</Text>
                <TouchableOpacity
                  onPress={() => acceptRequest(f.friendshipId)}
                  style={{ backgroundColor: Colors.goldDim, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ color: Colors.gold, fontWeight: '700', fontSize: 12 }}>Accept</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Friends List */}
        <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
          Your Friends ({friends.length})
        </Text>
        {friends.length === 0 ? (
          <Text style={{ color: Colors.textMuted, fontSize: 13 }}>No friends yet. Search to add some.</Text>
        ) : (
          friends.map((f: any, i) => (
            <View key={i} style={{
              backgroundColor: Colors.surface,
              borderRadius: 12,
              padding: 14,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: Colors.border,
            }}>
              <Text style={{ color: Colors.text, fontWeight: '600' }}>{f.display_name}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
