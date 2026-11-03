import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { AppText, IconSymbol, SheetModal } from '@/components/ui';
import { Colors, Fonts, Hit, Radius, Spacing, onColor } from '@/constants/theme';
import { useWorld } from '@/theme';
import { Avatar } from './Avatar';

const SHEET_H = Math.round(Dimensions.get('window').height * 0.75);

interface Props {
  visible: boolean;
  comments: any[];
  loading: boolean;
  text: string;
  sending: boolean;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onClose: () => void;
}

export function CommentsSheet({ visible, comments, loading, text, sending, onChangeText, onSend, onClose }: Props) {
  const world = useWorld();
  return (
    <SheetModal visible={visible} onClose={onClose} title="Comments" snapHeight={SHEET_H}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.list}>
        {loading && <ActivityIndicator color={world.aura} />}
        {!loading && comments.length === 0 && <AppText variant="body" style={styles.center}>No comments yet. Say something.</AppText>}
        {comments.map(c => (
          <View key={c.id} style={styles.comment}>
            <Avatar url={c.users?.avatar_url} name={c.users?.display_name ?? '?'} color={world.aura} size={32} />
            <View style={styles.flex}>
              <AppText variant="label" color={Colors.text}>{c.users?.display_name ?? 'Unknown'}</AppText>
              <AppText variant="body" color={Colors.text}>{c.content}</AppText>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={onChangeText}
          placeholder="Add a comment"
          placeholderTextColor={Colors.textMuted}
          multiline
          style={styles.input}
        />
        <TouchableOpacity
          onPress={onSend}
          disabled={!text.trim() || sending}
          style={[styles.send, { backgroundColor: text.trim() ? world.aura : Colors.surface2 }]}
          accessibilityLabel="Post comment"
        >
          {sending ? <ActivityIndicator color={onColor(world.aura)} size="small" /> : <IconSymbol name="chevronUp" size={20} color={text.trim() ? onColor(world.aura) : Colors.textMuted} />}
        </TouchableOpacity>
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: Spacing.md, paddingBottom: Spacing.md },
  center: { textAlign: 'center', marginTop: Spacing.xxl },
  comment: { flexDirection: 'row', gap: Spacing.md },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, paddingTop: Spacing.sm },
  input: {
    flex: 1, minHeight: Hit.min, maxHeight: 100, backgroundColor: Colors.surface2, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 12, color: Colors.text, fontFamily: Fonts.body, fontSize: 15,
  },
  send: { width: Hit.min, height: Hit.min, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
});
