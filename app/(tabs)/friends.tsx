import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Hit, Radius, Spacing } from '@/constants/theme';
import { AppText, Button, EmptyState } from '@/components/ui';
import { FriendProfileModal } from '@/components/FriendProfileModal';
import { useWorld, useWorldStore } from '@/theme';
import { RANK_TIERS } from '@/constants/ranks';
import { unitFromProfile } from '@/lib/units';
import { Leaderboard } from '@/components/social/Leaderboard';
import { FeedPostCard } from '@/components/social/FeedPostCard';
import { CommentsSheet } from '@/components/social/CommentsSheet';
import { PeopleSheet } from '@/components/social/PeopleSheet';
import { QRScanner } from '@/components/social/QRScanner';
import { useSocialData, type FeedScope } from '@/components/social/useSocialData';
import { useSocialActions } from '@/components/social/useSocialActions';
import type { FeedPost } from '@/components/social/types';

/** Social. Hero: the Power Level leaderboard (each row in that friend's aura). Feed below. */
export default function SocialScreen() {
  const world = useWorld();
  const { user, profile } = useAuth();
  const unit = unitFromProfile(profile?.unit_pref);
  const data = useSocialData(user, profile);
  const act = useSocialActions({
    userId: user?.id, friends: data.friends,
    setFeed: data.setFeed, setFriends: data.setFriends, setPending: data.setPending, reload: data.reload,
  });
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const rankKey = useWorldStore(s => s.rankKey);
  const myTier = RANK_TIERS.find(t => t.key === rankKey);

  // Auto-open the creator's profile when arriving from Home's First Steps
  useFocusEffect(useCallback(() => {
    const toOpen = (global as any).__openFriendProfile;
    if (toOpen) {
      (global as any).__openFriendProfile = null;
      setTimeout(() => setProfileId(toOpen), 300);
    }
  }, []));

  const openProfile = useCallback((id: string) => { setPeopleOpen(false); setProfileId(id); }, []);
  const renderPost = useCallback(({ item }: { item: FeedPost }) => (
    <FeedPostCard
      post={item}
      unit={unit}
      isMine={item.userId === user?.id}
      onOpenProfile={openProfile}
      onLike={act.toggleLike}
      onComments={act.comments.open}
      onSafety={act.safetyMenu}
    />
  ), [unit, user?.id, act.toggleLike, act.comments.open, act.safetyMenu]);

  const scopes: FeedScope[] = ['friends', 'global'];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <FlashList
        data={data.loading ? [] : data.feed}
        keyExtractor={p => p.workoutId}
        renderItem={renderPost}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={data.refresh} tintColor={world.aura} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <AppText variant="display" style={styles.flex}>Social</AppText>
              <Button
                label={data.pending.length ? `Requests ${data.pending.length}` : 'Friends'}
                icon="people"
                variant={data.pending.length ? 'tinted' : 'ghost'}
                size="sm"
                onPress={() => setPeopleOpen(true)}
              />
            </View>
            <Leaderboard
              friends={data.friends}
              me={{
                id: user?.id ?? 'me', name: 'You', avatarUrl: profile?.avatar_url, power: data.myPower,
                rankLabel: myTier?.label, rankColor: myTier?.color,
              }}
              onOpen={openProfile}
              onAddFriends={() => setPeopleOpen(true)}
            />
            <View style={styles.scopes}>
              <AppText variant="heading" style={styles.flex}>Feed</AppText>
              {scopes.map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => data.setFeedScope(s)}
                  style={[styles.scope, data.feedScope === s && { borderColor: world.aura, backgroundColor: world.aura + '1F' }]}
                  accessibilityState={{ selected: data.feedScope === s }}
                >
                  <AppText variant="label" color={data.feedScope === s ? world.aura : Colors.textSecondary}>{s === 'friends' ? 'Friends' : 'Global'}</AppText>
                </TouchableOpacity>
              ))}
            </View>
            {data.loading && <ActivityIndicator color={world.aura} />}
            {!data.loading && data.feed.length === 0 && (
              data.friends.length === 0 && data.feedScope === 'friends'
                ? <EmptyState icon="people" title="No friends yet" body="Add friends to see their workouts here." cta={{ label: 'Find friends', onPress: () => setPeopleOpen(true) }} />
                : <EmptyState icon="lift" title="No workouts yet" body="When your friends finish a workout it shows here." />
            )}
          </View>
        }
      />

      <PeopleSheet
        visible={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        friends={data.friends}
        pending={data.pending}
        search={act.search}
        onSearchChange={act.setSearch}
        onSearch={act.runSearch}
        searching={act.searching}
        results={act.results}
        onScan={() => { setPeopleOpen(false); setTimeout(act.scanner.start, 300); }}
        onOpen={openProfile}
        onAdd={act.sendRequest}
        onAccept={act.accept}
        onDecline={act.decline}
        onRemove={act.remove}
      />
      <CommentsSheet
        visible={!!act.comments.workoutId}
        comments={act.comments.list}
        loading={act.comments.loading}
        text={act.comments.text}
        sending={act.comments.sending}
        onChangeText={act.comments.setText}
        onSend={act.comments.send}
        onClose={act.comments.close}
      />
      <QRScanner visible={act.scanner.open} onScan={act.scanner.onScan} onClose={act.scanner.close} />
      <FriendProfileModal
        visible={!!profileId}
        userId={profileId}
        onFriended={f => {
          // Optimistic: the new friend is in the list before the sheet closes.
          data.setFriends(prev => [
            {
              id: f.id, friendshipId: f.friendshipId, display_name: f.display_name, avatar_url: f.avatar_url,
              bio: f.bio, bodyweight_lbs: f.bodyweight_lbs, is_owner: f.is_owner, is_og: f.is_og, is_pro: f.is_pro,
            },
            ...prev.filter(x => x.id !== f.id),
          ]);
        }}
        onClose={() => {
          setProfileId(null);
          // A friendship may have just been created (creator auto-accepts)
          data.reload();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 48 },
  header: { gap: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  scopes: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  scope: { minHeight: 36, paddingHorizontal: Spacing.md, justifyContent: 'center', borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
});
