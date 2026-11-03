import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { SkeletonBlock } from '@/components/ui';

/** First-load placeholder mirroring Home's layout — only when nothing is cached. */
export function HomeSkeleton() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <SkeletonBlock width="55%" height={14} />
        <SkeletonBlock height={380} radius={Radius.sm} />
        <SkeletonBlock height={190} radius={Radius.lg} />
        <SkeletonBlock height={60} radius={Radius.lg} />
        <SkeletonBlock height={60} radius={Radius.lg} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.screenH, gap: Spacing.group },
});
