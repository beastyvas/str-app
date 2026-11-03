import { Dimensions, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { AppText, Button, IconSymbol, Section, SheetModal } from '@/components/ui';
import { Colors, Fonts, Hit, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { Avatar } from './Avatar';
import type { Friend, PendingRequest } from './types';

const SHEET_H = Math.round(Dimensions.get('window').height * 0.88);

interface Props {
  visible: boolean;
  onClose: () => void;
  friends: Friend[];
  pending: PendingRequest[];
  search: string;
  onSearchChange: (s: string) => void;
  onSearch: () => void;
  searching: boolean;
  results: any[];
  onScan: () => void;
  onOpen: (id: string) => void;
  onAdd: (id: string) => void;
  onAccept: (friendshipId: string) => void;
  onDecline: (friendshipId: string) => void;
  onRemove: (friendshipId: string, name: string) => void;
}

/** Add / manage friends: scan, search, requests, and your crew. */
export function PeopleSheet(p: Props) {
  const world = useWorld();
  return (
    <SheetModal visible={p.visible} onClose={p.onClose} title="Friends" snapHeight={SHEET_H}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.searchRow}>
          <View style={styles.search}>
            <IconSymbol name="search" size={16} color={Colors.textMuted} />
            <TextInput
              value={p.search}
              onChangeText={p.onSearchChange}
              placeholder="Search @username or name"
              placeholderTextColor={Colors.textMuted}
              onSubmitEditing={p.onSearch}
              returnKeyType="search"
              autoCapitalize="none"
              style={styles.input}
            />
          </View>
          <Button label="Scan QR" icon="qr" variant="secondary" size="sm" onPress={p.onScan} />
        </View>

        {p.results.length > 0 && (
          <Section title="Results">
            <View style={styles.list}>
              {p.results.map((u: any, i: number) => (
                <TouchableOpacity key={u.id} onPress={() => p.onOpen(u.id)} style={[styles.row, i > 0 && styles.divider]}>
                  <Avatar url={u.avatar_url} name={u.display_name ?? '?'} color={world.aura} size={36} />
                  <View style={styles.flex}>
                    <AppText variant="heading" numberOfLines={1}>{u.display_name}</AppText>
                    {u.username && <AppText variant="caption" color={world.aura}>@{u.username}</AppText>}
                  </View>
                  {u.alreadyFriend ? <AppText variant="label" color={Colors.success}>Friends</AppText>
                    : u.requestSent ? <AppText variant="label">Sent</AppText>
                    : <Button label="Add" variant="tinted" size="sm" onPress={() => p.onAdd(u.id)} />}
                </TouchableOpacity>
              ))}
            </View>
          </Section>
        )}

        {p.pending.length > 0 && (
          <Section title={`Requests (${p.pending.length})`}>
            <View style={styles.list}>
              {p.pending.map((f, i) => (
                <View key={f.friendshipId} style={[styles.row, i > 0 && styles.divider]}>
                  <Avatar url={f.avatar_url} name={f.display_name} color={world.aura} size={36} />
                  <AppText variant="heading" style={styles.flex} numberOfLines={1}>{f.display_name}</AppText>
                  <TouchableOpacity onPress={() => p.onDecline(f.friendshipId)} style={styles.icon} accessibilityLabel="Decline">
                    <IconSymbol name="close" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                  <Button label="Accept" size="sm" onPress={() => p.onAccept(f.friendshipId)} />
                </View>
              ))}
            </View>
          </Section>
        )}

        <Section title={`Your crew (${p.friends.length})`}>
          {p.friends.length === 0 ? (
            <AppText variant="body">No friends yet. Search for a username or scan a friend's QR code.</AppText>
          ) : (
            <View style={styles.list}>
              {p.friends.map((f, i) => (
                <TouchableOpacity key={f.id} onPress={() => p.onOpen(f.id)} onLongPress={() => p.onRemove(f.friendshipId, f.display_name)} style={[styles.row, i > 0 && styles.divider]}>
                  <Avatar url={f.avatar_url} name={f.display_name} color={f.rankTierColor ?? Colors.textMuted} size={36} />
                  <View style={styles.flex}>
                    <AppText variant="heading" numberOfLines={1}>{f.display_name}</AppText>
                    {f.rankTierLabel && <AppText variant="caption" color={f.rankTierColor} style={styles.rank}>{f.rankTierLabel}</AppText>}
                  </View>
                  <IconSymbol name="chevronRight" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {p.friends.length > 0 && <AppText variant="caption">Long-press a friend to remove them.</AppText>}
        </Section>
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.xl, paddingBottom: Spacing.xxl },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  search: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, minHeight: Hit.min,
    backgroundColor: Colors.surface2, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.borderLight,
  },
  input: { flex: 1, minHeight: Hit.min, color: Colors.text, fontFamily: Fonts.body, fontSize: 15 },
  list: { backgroundColor: Colors.surface2, borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 56, paddingHorizontal: Spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  flex: { flex: 1, gap: 2 },
  rank: { fontFamily: Fonts.display, fontSize: 11 },
  icon: { width: Hit.min, height: Hit.min, alignItems: 'center', justifyContent: 'center' },
});
