import { ReactNode, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View,
} from 'react-native';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppText } from './AppText';

const SLIDE_FROM = 80; // px below resting position the panel springs in from

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
  const progress = useSharedValue(0); // 0 = hidden, 1 = shown

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
  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * SLIDE_FROM }],
  }));

  if (!mounted) return null;

  const panel = (
    <Animated.View style={[styles.panel, snapHeight != null && { height: snapHeight }, panelStyle]}>
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
        {keyboardAware ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
  backdrop: { backgroundColor: '#000000B3' },
  panel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl + 4,
    borderTopRightRadius: Radius.xl + 4,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 34,
    paddingTop: Spacing.sm,
    maxHeight: '88%',
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
