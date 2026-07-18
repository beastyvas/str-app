import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { SkeletonBlock } from '@/components/ui';

/**
 * First-load placeholder mirroring Home's real layout (greeting, rank hero,
 * today card, week strip, stats row) — shown ONLY when there's no cached
 * data; refocus renders cached content instantly instead.
 */
export function HomeSkeleton() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        {/* Greeting */}
        <SkeletonBlock width="45%" height={12} />
        <SkeletonBlock width="70%" height={30} />
        {/* Rank hero */}
        <SkeletonBlock height={140} radius={Radius.xl} style={styles.gap} />
        {/* Today card */}
        <SkeletonBlock height={110} radius={Radius.xl} />
        {/* Week strip */}
        <View style={styles.row}>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonBlock key={i} width={36} height={48} radius={Radius.md} />
          ))}
        </View>
        {/* Stats row */}
        <View style={styles.row}>
          <SkeletonBlock height={84} radius={Radius.lg} style={styles.flex} />
          <SkeletonBlock height={84} radius={Radius.lg} style={styles.flex} />
          <SkeletonBlock height={84} radius={Radius.lg} style={styles.flex} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.xl, gap: Spacing.lg },
  gap: { marginTop: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'space-between' },
  flex: { flex: 1, width: undefined },
});
