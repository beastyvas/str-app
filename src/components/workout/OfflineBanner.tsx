import { StyleSheet, TouchableOpacity } from 'react-native';
import { AppText, IconSymbol } from '@/components/ui';
import { Colors, Hit, Spacing } from '@/constants/theme';

/** Shown only after a sync attempt actually failed. Quiet, tap to retry. */
export function OfflineBanner({ count, onRetry }: { count: number; onRetry: () => void }) {
  return (
    <TouchableOpacity onPress={onRetry} activeOpacity={0.8} style={styles.bar} accessibilityLabel="Retry sync">
      <IconSymbol name="repeat" size={14} color={Colors.textSecondary} />
      <AppText variant="label">
        Offline · {count === 1 ? '1 set' : `${count} sets`} saved on this phone. Tap to retry.
      </AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: Hit.min,
    paddingHorizontal: Spacing.screenH, backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
});
