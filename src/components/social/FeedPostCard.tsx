import { memo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText, IconSymbol } from '@/components/ui';
import { UserBadges } from '@/components/UserBadges';
import { Colors, Fonts, Hit, Radius, Spacing } from '@/constants/theme';
import { fmtVolume, toDisplay, type WeightUnit } from '@/lib/units';
import { Avatar } from './Avatar';
import { formatDuration, timeAgo, type FeedPost } from './types';

interface Props {
  post: FeedPost;
  unit: WeightUnit;
  isMine: boolean;
  onOpenProfile: (id: string) => void;
  onLike: (post: FeedPost) => void;
  onComments: (workoutId: string) => void;
  onSafety: (post: FeedPost) => void;
}

/** One workout in the feed: header, name + stats, note, sets, like/comment. */
export const FeedPostCard = memo(function FeedPostCard({ post, unit, isMine, onOpenProfile, onLike, onComments, onSafety }: Props) {
  const tint = post.rankTierColor ?? Colors.textMuted;
  return (
    <View style={[styles.card, { borderTopColor: tint }]}>
      {post.photoUrl && <Image source={{ uri: post.photoUrl }} style={styles.photo} contentFit="cover" cachePolicy="disk" transition={150} />}
      <View style={styles.head}>
        <TouchableOpacity onPress={() => onOpenProfile(post.userId)} style={styles.who}>
          <Avatar url={post.avatarUrl} name={post.displayName} color={tint} size={40} />
          <View style={styles.flex}>
            <View style={styles.nameRow}>
              <AppText variant="heading" numberOfLines={1} style={styles.shrink}>{post.displayName}</AppText>
              <UserBadges isOwner={post.isOwner} isOg={post.isOg} isPro={post.isPro} size="sm" />
            </View>
            <AppText variant="caption">
              {post.rankTierLabel ? <AppText variant="caption" color={tint} style={styles.rank}>{post.rankTierLabel}  </AppText> : null}
              {timeAgo(post.endedAt)}
            </AppText>
          </View>
        </TouchableOpacity>
        {!isMine && (
          <TouchableOpacity onPress={() => onSafety(post)} style={styles.icon} accessibilityLabel="Report or block">
            <IconSymbol name="ellipsis" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.body}>
        <AppText variant="title" style={styles.title}>{post.workoutName}</AppText>
        <AppText variant="label">
          {formatDuration(post.startedAt, post.endedAt)} · {post.setsCount} sets · {fmtVolume(post.totalVolume, unit)}
        </AppText>
        {post.notes && <AppText variant="body" color={Colors.text}>{post.notes}</AppText>}
        {post.exerciseSummaries.length > 0 && (
          <View style={styles.sets}>
            {post.exerciseSummaries.map((ex, i) => (
              <View key={i} style={[styles.ex, i > 0 && styles.divider]}>
                <AppText variant="label" color={Colors.text} numberOfLines={1}>{ex.name}</AppText>
                <AppText variant="caption" mono>
                  {ex.sets.map(s => `${s.weight === 0 ? 'BW' : toDisplay(s.weight, unit)}×${s.reps}`).join('  ')}
                </AppText>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={() => onLike(post)} style={styles.action} accessibilityLabel={post.isLiked ? 'Unlike' : 'Like'}>
          <IconSymbol name={post.isLiked ? 'heart' : 'heartOutline'} size={20} color={post.isLiked ? tint : Colors.textMuted} />
          {post.likeCount > 0 && <AppText variant="label">{post.likeCount}</AppText>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onComments(post.workoutId)} style={styles.action} accessibilityLabel="Comments">
          <IconSymbol name="comment" size={19} color={Colors.textMuted} />
          {post.commentCount > 0 && <AppText variant="label">{post.commentCount}</AppText>}
        </TouchableOpacity>
      </View>

      {post.previewComments.length > 0 && (
        <View style={styles.comments}>
          {post.previewComments.map(c => (
            <AppText key={c.id} variant="label" numberOfLines={3}>
              <AppText variant="label" color={Colors.text}>{c.displayName}  </AppText>{c.content}
            </AppText>
          ))}
          {post.commentCount > post.previewComments.length && (
            <TouchableOpacity onPress={() => onComments(post.workoutId)}>
              <AppText variant="caption">View all {post.commentCount} comments</AppText>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, borderTopWidth: 3, overflow: 'hidden', marginBottom: Spacing.lg },
  photo: { width: '100%', aspectRatio: 1 },
  head: { flexDirection: 'row', alignItems: 'center', paddingLeft: Spacing.lg, paddingTop: Spacing.md },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  shrink: { flexShrink: 1 },
  rank: { fontFamily: Fonts.display, fontSize: 11 },
  icon: { width: Hit.min, height: Hit.min, alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  title: { fontSize: 19, lineHeight: 24 },
  sets: { backgroundColor: Colors.bg, borderRadius: Radius.md, overflow: 'hidden' },
  ex: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 2 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  actions: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: Hit.min, paddingHorizontal: Spacing.sm },
  comments: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: 4 },
});
