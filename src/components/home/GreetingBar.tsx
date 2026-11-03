import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Hit, Spacing } from '@/constants/theme';
import { AppText, PressableScale } from '@/components/ui';
import { useWorld } from '@/theme';
import type { LastWorkout } from '@/hooks/useHomeData';

export function getSmartGreetingLine(firstName: string, lastWorkout: LastWorkout | null, todaySession: string | null): string {
  const h = new Date().getHours();
  const time = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  if (todaySession) return `Good ${time}, ${firstName}. ${todaySession} day.`;
  if (lastWorkout) {
    const hoursAgo = (Date.now() - new Date(lastWorkout.started_at).getTime()) / 3600000;
    if (hoursAgo < 18) return `Recovery day, ${firstName}.`;
    if (hoursAgo < 54) return `Ready for the next one, ${firstName}?`;
  }
  return `Good ${time}, ${firstName}.`;
}

/** One small greeting line, avatar top-right. No big header block. */
export function GreetingBar({ greeting, avatarUrl, initial, onAvatarPress }: {
  greeting: string; avatarUrl?: string | null; initial: string; onAvatarPress: () => void;
}) {
  const world = useWorld();
  return (
    <View style={styles.row}>
      <AppText variant="label" style={styles.flex} numberOfLines={1}>{greeting}</AppText>
      <PressableScale onPress={onAvatarPress} haptic="light" accessibilityLabel="Profile" style={styles.hit}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={[styles.avatar, { borderColor: world.aura }]} cachePolicy="disk" transition={150} />
        ) : (
          <View style={[styles.avatar, styles.fallback, { borderColor: world.aura }]}>
            <AppText variant="heading" color={world.aura}>{initial}</AppText>
          </View>
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  hit: { minWidth: Hit.min, minHeight: Hit.min, alignItems: 'flex-end', justifyContent: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5 },
  fallback: { backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center' },
});
