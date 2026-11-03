import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText } from '@/components/ui';
import { MangaPanel, formatPower } from '@/components/anime';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { Avatar } from './Avatar';
import type { Friend } from './types';

interface Me { id: string; name: string; avatarUrl?: string | null; power: number | null; rankLabel?: string; rankColor?: string }

/**
 * Hero: me + friends sorted by Power Level. Each row is tinted with THAT
 * lifter's aura (their rank color), not mine.
 */
export function Leaderboard({ friends, me, onOpen, onAddFriends }: {
  friends: Friend[]; me: Me; onOpen: (id: string) => void; onAddFriends: () => void;
}) {
  const world = useWorld();
  const rows = [
    { id: me.id, name: 'You', avatar: me.avatarUrl, power: me.power, label: me.rankLabel, color: me.rankColor ?? world.aura, partial: false, isMe: true },
    ...friends.map(f => ({
      id: f.id, name: f.display_name, avatar: f.avatar_url, power: f.powerLevel ?? null,
      label: f.rankTierLabel, color: f.rankTierColor ?? Colors.textMuted, partial: !!f.powerPartial, isMe: false,
    })),
  ].sort((a, b) => (b.power ?? -1) - (a.power ?? -1));

  return (
    <MangaPanel motif="header" padding={Spacing.lg}>
      <View style={styles.head}>
        <AppText variant="title" style={styles.flex}>Power ranking</AppText>
        <TouchableOpacity onPress={onAddFriends} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <AppText variant="label" color={world.aura}>Add friends</AppText>
        </TouchableOpacity>
      </View>
      {rows.map((r, i) => (
        <TouchableOpacity
          key={r.id}
          disabled={r.isMe}
          onPress={() => onOpen(r.id)}
          style={[styles.row, { borderLeftColor: r.color, backgroundColor: r.color + (r.isMe ? '22' : '10') }]}
          accessibilityLabel={`${i + 1}. ${r.name}, ${r.label ?? 'unranked'}, power ${r.power ?? 'unknown'}`}
        >
          <AppText variant="stat" color={i === 0 ? r.color : Colors.textMuted} style={styles.place}>{i + 1}</AppText>
          <Avatar url={r.avatar} name={r.name} color={r.color} size={36} />
          <View style={styles.flex}>
            <AppText variant="heading" numberOfLines={1}>{r.name}</AppText>
            {r.label && <AppText variant="caption" color={r.color} style={styles.rank}>{r.label}</AppText>}
          </View>
          <AppText variant="stat" color={r.power != null ? Colors.text : Colors.textMuted}>
            {r.power != null ? `${r.partial ? '≈' : ''}${formatPower(r.power)}` : '—'}
          </AppText>
        </TouchableOpacity>
      ))}
      {friends.length === 0 && (
        <AppText variant="caption" style={styles.empty}>Add friends to see where you rank.</AppText>
      )}
    </MangaPanel>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 56, paddingHorizontal: Spacing.md, borderLeftWidth: 3, marginBottom: Spacing.xs },
  place: { width: 22, textAlign: 'center' },
  rank: { fontFamily: Fonts.display, fontSize: 11 },
  empty: { marginTop: Spacing.sm },
});
