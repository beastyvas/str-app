import { ReactNode, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions,
} from 'react-native';
import Animated, {
  runOnJS, useAnimatedKeyboard, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { AppText } from './AppText';

const SLIDE_FROM = 80; // px below resting position the panel springs in from
const TOP_GAP = 12;    // breathing room between the panel and the status bar
const IOS = Platform.OS === 'ios';

interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Fixed panel height; omit for auto (content-sized) */
  snapHeight?: number;
  keyboardAware?: boolean;
}

/**
 * The app-standard bottom sheet: fade backdrop, spring-up panel, drag-handle
 * bar. Replaces `Modal animationType="slide"` everywhere. The RN Modal stays
 * mounted during the close animation so the panel can spring out.
 */
export function SheetModal({
  visible, onClose, title, children, snapHeight, keyboardAware = true,
}: SheetModalProps) {
  const [mounted, setMounted] = useState(visible);
  const world = useWorld();
  const progress = useSharedValue(0); // 0 = hidden, 1 = shown
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  // iOS: ride the keyboard frame-by-frame AND clamp the panel so it always
  // fits between the status bar and the keyboard. A fixed snapHeight plus a
  // keyboard-height lift used to push the header/search off the top.
  const tracksKeyboard = IOS && keyboardAware;
  const maxH = winH - insets.top - TOP_GAP;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withSpring(1, { damping: 18, stiffness: 220 });
    } else {
      progress.value = withTiming(0, { duration: 180 }, finished => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panelStyle = useAnimatedStyle(() => {
    const kb = tracksKeyboard ? keyboard.height.value : 0;
    const room = maxH - kb;
    return {
      opacity: progress.value,
      transform: [{ translateY: (1 - progress.value) * SLIDE_FROM }],
      marginBottom: kb,
      maxHeight: room,
      // Home-indicator padding is pointless while the keyboard covers it.
      paddingBottom: kb > 0 ? Spacing.md : 34,
      ...(snapHeight != null ? { height: Math.min(snapHeight, room) } : null),
    };
  });

  if (!mounted) return null;

  const panel = (
    <Animated.View style={[styles.panel, { borderTopColor: world.aura }, panelStyle]}>
      <View style={styles.handle} />
      {title != null && (
        <AppText variant="title" style={styles.title}>{title}</AppText>
      )}
      {children}
    </Animated.View>
  );

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        {keyboardAware && !IOS ? (
          <KeyboardAvoidingView
            behavior="height"
            style={styles.kav}
            pointerEvents="box-none"
          >
            {panel}
          </KeyboardAvoidingView>
        ) : panel}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  kav: { justifyContent: 'flex-end' },
  backdrop: { backgroundColor: Colors.ink + 'B3' },
  panel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderTopWidth: 2,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  title: { marginBottom: Spacing.lg },
});
