import { StyleSheet, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppText, Card, EmptyState } from '@/components/ui';
import { HomeData } from '@/hooks/useHomeData';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}

interface FriendActivityCardProps {
  post: HomeData['recentFriendPost'];
  onPress: () => void;
}

export function FriendActivityCard({ post, onPress }: FriendActivityCardProps) {
  if (!post) {
    return (
      <Card onPress={onPress} padding="lg">
        <EmptyState
          icon="people"
          title="No crew yet"
          body="Add friends to see their sessions, PRs, and progress here"
          cta={{ label: 'Find friends →', onPress }}
        />
      </Card>
    );
  }

  return (
    <Card onPress={onPress} padding="lg" style={{ borderColor: Colors.accent + '30' }}>
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <AppText variant="heading" color={Colors.accent}>
            {post.displayName.charAt(0).toUpperCase()}
          </AppText>
        </View>
        <View style={styles.headerText}>
          <AppText variant="caption" color={Colors.text} style={styles.name}>{post.displayName}</AppText>
          <AppText variant="micro">{post.workoutName} · {timeAgo(post.endedAt)}</AppText>
        </View>
        <AppText variant="caption" color={Colors.accent} style={styles.feedLink}>Feed →</AppText>
      </View>
      {post.notes && (
        <AppText variant="body" color={Colors.text} numberOfLines={2} style={styles.notes}>
          {post.notes}
        </AppText>
      )}
      {post.exercises.length > 0 && (
        <View style={styles.chips}>
          {post.exercises.slice(0, 4).map((ex, i) => (
            <View key={i} style={styles.chip}>
              <AppText variant="micro">{ex}</AppText>
            </View>
          ))}
          {post.exercises.length > 4 && (
            <AppText variant="micro" style={styles.more}>+{post.exercises.length - 4}</AppText>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.accent + '22',
    borderWidth: 1, borderColor: Colors.accent + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 1 },
  name: { fontWeight: '800' },
  feedLink: { fontWeight: '700' },
  notes: { marginTop: Spacing.sm + 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: Spacing.sm + 2 },
  chip: { backgroundColor: Colors.surface2, borderRadius: Radius.sm - 1, paddingHorizontal: 7, paddingVertical: 3 },
  more: { alignSelf: 'center' },
});
