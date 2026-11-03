import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText, IconSymbol } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { FriendToday } from '@/hooks/useHomeData';

/** One row of avatars + "3 friends trained today". */
export function FriendsTodayRow({ friends, onPress }: { friends: FriendToday[]; onPress: () => void }) {
  const label = friends.length === 0
    ? 'No friends have trained yet today'
    : `${friends.length} friend${friends.length === 1 ? '' : 's'} trained today`;
  return (
    <TouchableOpacity onPress={onPress} style={styles.row} accessibilityRole="button">
      {friends.length > 0 && (
        <View style={styles.stack}>
          {friends.slice(0, 4).map((f, i) => (
            <View key={f.id} style={[styles.avatar, i > 0 && styles.overlap]}>
              {f.avatarUrl
                ? <Image source={{ uri: f.avatarUrl }} style={styles.img} cachePolicy="disk" />
                : <AppText variant="label" color={Colors.text}>{f.name.charAt(0).toUpperCase()}</AppText>}
            </View>
          ))}
        </View>
      )}
      <AppText variant="heading" style={styles.flex} numberOfLines={1}>{label}</AppText>
      <IconSymbol name="chevronRight" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 60, paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
  },
  stack: { flexDirection: 'row' },
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface3, overflow: 'hidden',
    borderWidth: 2, borderColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  overlap: { marginLeft: -10 },
  img: { width: '100%', height: '100%' },
  flex: { flex: 1, fontSize: 15 },
});
