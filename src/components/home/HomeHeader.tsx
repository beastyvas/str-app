import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppText, PressableScale } from '@/components/ui';
import { LastWorkout } from '@/hooks/useHomeData';

export function getSmartGreetingLine(lastWorkout: LastWorkout | null, todaySession: string | null): string {
  const h = new Date().getHours();
  const timeStr = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';

  if (todaySession) {
    return `${todaySession} day · good ${timeStr}`;
  }

  if (lastWorkout) {
    const hoursAgo = (Date.now() - new Date(lastWorkout.started_at).getTime()) / 3600000;
    if (hoursAgo < 18) return 'recovery mode — rest up';
    if (hoursAgo < 30) return 'ready for round two?';
    if (hoursAgo < 54) return 'one day out — time to load up';
    if (hoursAgo < 80) return `two days since last session`;
  }

  if (h < 12) return 'good morning';
  if (h < 17) return 'good afternoon';
  return 'good evening';
}

interface HomeHeaderProps {
  firstName: string;
  avatarUrl?: string | null;
  greeting: string;
  onAvatarPress: () => void;
}

export function HomeHeader({ firstName, avatarUrl, greeting, onAvatarPress }: HomeHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <AppText variant="overline">{greeting}</AppText>
        <AppText variant="display" style={styles.name}>{firstName}</AppText>
      </View>
      <PressableScale onPress={onAvatarPress} haptic="light">
        <View style={styles.avatarRing}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} cachePolicy="disk" transition={150} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <AppText variant="heading" color={Colors.accent}>
                {firstName.charAt(0).toUpperCase()}
              </AppText>
            </View>
          )}
        </View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  textCol: { flex: 1, gap: 4 },
  name: {},
  avatarRing: {
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: Colors.accent + '60',
    padding: 2,
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: {
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
