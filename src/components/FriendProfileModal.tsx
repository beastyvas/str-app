import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText, Button, IconSymbol, Section, SheetModal, StatTile } from '@/components/ui';
import { MangaPanel, formatPower } from '@/components/anime';
import { UserBadges } from './UserBadges';
import { Colors, Fonts, Hit, Radius, Spacing } from '@/constants/theme';
import { ROMAN } from '@/constants/ranks';
import { WORLDS, WorldScope } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { fmtVolume, toDisplay, unitFromProfile } from '@/lib/units';
import { timeAgo, formatDuration } from '@/components/social/types';
import { useFriendProfile, type Friended } from '@/components/friend/useFriendProfile';

const SHEET_H = Math.round(Dimensions.get('window').height * 0.9);

interface Props {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
  /** Fired when a request lands as accepted (creator auto-accept) */
  onFriended?: (friend: Friended) => void;
}

/**
 * A friend's profile — same layout as my Profile hero, rendered in THEIR
 * world (their rank's aura and motif).
 */
export function FriendProfileModal({ visible, userId, onClose, onFriended }: Props) {
  const { user: me, profile: myProfile } = useAuth();
  const unit = unitFromProfile(myProfile?.unit_pref); // their numbers in MY unit
  const { data, loading, adding, addFriend, safetyMenu } = useFriendProfile(userId, visible, me, myProfile?.bodyweight_lbs, onFriended, onClose);
  const isSelf = userId === me?.id;
  const p = data?.profile;
  const rank = data?.rank;
  const world = WORLDS[(p?.rank_tier_key as keyof typeof WORLDS) ?? rank?.tier.key ?? 'mortal'] ?? WORLDS.mortal;
  const prsHidden = !!data && !isSelf && data.status !== 'friends' && !p?.is_owner && data.prs.length === 0;
  const them = p?.display_name?.split(' ')[0] || 'Them';

  const h2h = data && data.myRank && rank && !isSelf && !prsHidden
    ? (['SQ', 'BP', 'DL'] as const).map(k => {
        const mine = data.myRank!.lifts.find(l => l.label === k)?.weight ?? 0;
        const theirs = rank.lifts.find(l => l.label === k)?.weight ?? 0;
        return { label: k === 'SQ' ? 'Squat' : k === 'BP' ? 'Bench' : 'Deadlift', mine, theirs };
      })
    : null;

  return (
    <SheetModal visible={visible} onClose={onClose} snapHeight={SHEET_H} keyboardAware={false}>
      <WorldScope world={world}>
        {loading && !data ? (
          <ActivityIndicator color={world.aura} style={styles.loading} />
        ) : !p ? (
          <AppText variant="body" style={styles.center}>Could not load profile</AppText>
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <MangaPanel motif="hero">
              <View style={styles.top}>
                <View style={[styles.avatar, { borderColor: world.aura }]}>
                  {p.avatar_url
                    ? <Image source={{ uri: p.avatar_url }} style={styles.img} cachePolicy="disk" transition={150} />
                    : <AppText variant="title" color={world.aura}>{(p.display_name ?? '?').charAt(0).toUpperCase()}</AppText>}
                </View>
                <View style={styles.flex}>
                  <AppText variant="title" numberOfLines={1}>{p.display_name}</AppText>
                  {p.username && <AppText variant="label" color={world.aura}>@{p.username}</AppText>}
                  <UserBadges isOwner={!!p.is_owner} isOg={!!p.is_og} isPro={!!p.is_pro} size="sm" />
                </View>
                {!isSelf && (
                  <TouchableOpacity onPress={safetyMenu} style={styles.icon} accessibilityLabel="Report or block">
                    <IconSymbol name="ellipsis" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              {!prsHidden && (
                <View style={styles.powerRow}>
                  <View>
                    <AppText variant="caption">Power level</AppText>
                    <AppText variant="power" style={styles.power}>
                      {data.power != null ? `${data.powerPartial ? '≈' : ''}${formatPower(data.power)}` : '—'}
                    </AppText>
                  </View>
                  {rank && (
                    <View style={[styles.rankChip, { borderColor: rank.tier.color }]}>
                      <AppText variant="heading" color={rank.tier.color} style={styles.rankText}>{rank.tier.label} {ROMAN[rank.subTier]}</AppText>
                    </View>
                  )}
                </View>
              )}
              <View style={styles.stats}>
                <StatTile label="Workouts" value={data.workoutCount} />
                <StatTile label="PRs" value={data.prs.length} />
                <StatTile label="Bodyweight" value={p.bodyweight_lbs ? `${Math.round(toDisplay(p.bodyweight_lbs, unit))} ${unit}` : '—'} />
              </View>
              {p.bio && <AppText variant="body">{p.bio}</AppText>}
              {!isSelf && (
                data.status === 'friends' ? <AppText variant="label" color={Colors.success}>Friends</AppText>
                : data.status === 'pending' ? <AppText variant="label">Request sent</AppText>
                : <Button label="Add friend" icon="add" onPress={addFriend} loading={adding} fullWidth />
              )}
            </MangaPanel>

            {prsHidden && (
              <AppText variant="body" style={styles.center}>Add {them} as a friend to see their lifts and head-to-head.</AppText>
            )}

            {h2h && (
              <Section title={`You vs ${them}`}>
                <View style={styles.list}>
                  {h2h.map((r, i) => (
                    <View key={r.label} style={[styles.row, i > 0 && styles.divider]}>
                      <AppText variant="label" style={styles.flex}>{r.label}</AppText>
                      <AppText variant="stat" color={r.mine > r.theirs ? world.aura : Colors.textSecondary} style={styles.h2hVal}>
                        {r.mine > 0 ? Math.round(toDisplay(r.mine, unit)) : '—'}
                      </AppText>
                      <AppText variant="stat" color={r.theirs > r.mine ? world.aura : Colors.textSecondary} style={styles.h2hVal}>
                        {r.theirs > 0 ? Math.round(toDisplay(r.theirs, unit)) : '—'}
                      </AppText>
                    </View>
                  ))}
                </View>
                <AppText variant="caption">You · {them}, in {unit}. Brighter = stronger.</AppText>
              </Section>
            )}

            {data.split && (
              <Section title="Training split">
                <AppText variant="heading">{data.split.splitLabel}</AppText>
                <AppText variant="caption">{data.split.sessionsPerWeek}× a week</AppText>
              </Section>
            )}

            {data.workouts.length > 0 && (
              <Section title="Recent workouts">
                <View style={styles.list}>
                  {data.workouts.map((w: any, i: number) => {
                    const sets = w.workout_sets ?? [];
                    const vol = sets.reduce((n: number, x: any) => n + x.weight * x.reps, 0);
                    return (
                      <View key={w.id} style={[styles.workout, i > 0 && styles.divider]}>
                        <View style={styles.wHead}>
                          <AppText variant="heading" numberOfLines={1} style={styles.flex}>{w.name}</AppText>
                          <AppText variant="caption">{timeAgo(w.started_at)}</AppText>
                        </View>
                        <AppText variant="caption">{sets.length} sets · {fmtVolume(vol, unit)} · {formatDuration(w.started_at, w.ended_at)}</AppText>
                        {w.notes ? <AppText variant="body" numberOfLines={2}>{w.notes}</AppText> : null}
                        {data.photos[w.id] && <Image source={{ uri: data.photos[w.id] }} style={styles.photo} contentFit="cover" cachePolicy="disk" transition={150} />}
                      </View>
                    );
                  })}
                </View>
              </Section>
            )}
          </ScrollView>
        )}
      </WorldScope>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 60 },
  center: { textAlign: 'center' },
  body: { gap: Spacing.group, paddingBottom: Spacing.xxl },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  flex: { flex: 1, gap: 2 },
  icon: { width: Hit.min, height: Hit.min, alignItems: 'center', justifyContent: 'center' },
  powerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: Spacing.lg, gap: Spacing.md },
  power: { fontSize: 40, lineHeight: 44 },
  rankChip: { borderWidth: 2, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, marginBottom: Spacing.xs },
  rankText: { fontFamily: Fonts.display, fontSize: 14 },
  stats: { flexDirection: 'row', gap: Spacing.sm, marginVertical: Spacing.md },
  list: { backgroundColor: Colors.surface2, borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: Spacing.lg, gap: Spacing.md },
  h2hVal: { width: 64, textAlign: 'right', fontSize: 17 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  workout: { padding: Spacing.lg, gap: 4 },
  wHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  photo: { width: '100%', height: 170, borderRadius: Radius.md, marginTop: Spacing.sm },
});
