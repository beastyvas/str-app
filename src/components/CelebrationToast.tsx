import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/AppText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';

interface Props {
  visible: boolean;
  title: string;
  sub?: string;
  onDone: () => void;
}

/**
 * Small milestone toast for moments no cameo covers (first friend, plan
 * requested). Onboarding and first-workout celebrations are cameos now.
 */
export function CelebrationToast({ visible, title, sub, onDone }: Props) {
  const world = useWorld();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const t = setTimeout(onDone, 3600);
    return () => clearTimeout(t);
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View
      entering={FadeInUp.duration(260)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + Spacing.sm }]}
    >
      <View style={[styles.toast, { borderColor: world.aura }]}>
        <IconSymbol name="checkCircle" size={22} color={world.aura} />
        <View style={styles.flex}>
          <AppText variant="heading">{title}</AppText>
          {sub ? <AppText variant="caption">{sub}</AppText> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.screenH, right: Spacing.screenH, zIndex: 100 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderWidth: 2, padding: Spacing.lg },
  flex: { flex: 1, gap: 2 },
});
