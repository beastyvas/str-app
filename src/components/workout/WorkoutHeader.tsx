import { ActionSheetIOS, Alert, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText, Button, IconSymbol } from '@/components/ui';
import { Colors, Hit, Spacing, Type } from '@/constants/theme';
import { useWorld } from '@/theme';
import { ElapsedTime } from './ElapsedTime';

interface Props {
  name: string;
  startedAt: Date | string;
  finishing: boolean;
  onRename: () => void;
  onFinish: () => void;
  onShowTemplates: () => void;
  onDiscard: () => void;
}

/**
 * Workout name (tap to rename), the isolated ElapsedTime clock in `stat`, a
 * quiet overflow, and Finish — secondary until tapped (confirms in a sheet).
 * The world motif lives in this header band, never behind set rows.
 */
export function WorkoutHeader({ name, startedAt, finishing, onRename, onFinish, onShowTemplates, onDiscard }: Props) {
  const world = useWorld();
  const Motif = world.Motif;

  const openMenu = () => {
    const opts = ['View templates', 'Discard workout', 'Cancel'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: name, options: opts, cancelButtonIndex: 2, destructiveButtonIndex: 1, userInterfaceStyle: 'dark' },
        i => { if (i === 0) onShowTemplates(); if (i === 1) onDiscard(); },
      );
    } else {
      Alert.alert(name, undefined, [
        { text: opts[0], onPress: onShowTemplates },
        { text: opts[1], style: 'destructive', onPress: onDiscard },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none"><Motif intensity="header" /></View>
      <TouchableOpacity onPress={onRename} style={styles.title} accessibilityLabel={`${name}, tap to rename`}>
        <AppText variant="heading" numberOfLines={1}>{name}</AppText>
        <ElapsedTime startedAt={startedAt} style={[Type.stat, styles.clock, { color: world.aura }]} />
      </TouchableOpacity>
      <TouchableOpacity onPress={openMenu} style={styles.icon} accessibilityLabel="Workout options">
        <IconSymbol name="ellipsis" size={20} color={Colors.textMuted} />
      </TouchableOpacity>
      <Button label="Finish" variant="secondary" size="sm" onPress={onFinish} loading={finishing} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, overflow: 'hidden',
    paddingHorizontal: Spacing.screenH, paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  title: { flex: 1, minHeight: Hit.min, justifyContent: 'center' },
  clock: { fontSize: 18, lineHeight: 22 },
  icon: { width: Hit.min, height: Hit.min, alignItems: 'center', justifyContent: 'center' },
});
