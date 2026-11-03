import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText, IconSymbol } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import type { FirstSteps } from '@/hooks/useHomeData';

// Restyle ONLY — the three tasks, their order, and their completion
// semantics are the activation flow. Do not change what marks steps done.
interface Props {
  firstSteps: FirstSteps;
  isNewLifter: boolean;
  onStartFirstWorkout: () => void;
  onCoachStep: () => void;
  onAddFriend: () => void;
}

/** Compact getting-started checklist, shown only while incomplete. */
export function FirstStepsRow({ firstSteps, isNewLifter, onStartFirstWorkout, onCoachStep, onAddFriend }: Props) {
  const world = useWorld();
  const steps = [
    { done: firstSteps.hasWorkout, label: 'Log your first workout', onPress: onStartFirstWorkout },
    { done: firstSteps.hasCoach, label: isNewLifter ? 'Ask your coach anything' : 'Get a weekly plan from your coach', onPress: onCoachStep },
    { done: firstSteps.hasFriend, label: 'Add your first friend (try @beastyvas)', onPress: onAddFriend },
  ];
  const done = steps.filter(s => s.done).length;
  return (
    <View style={styles.list}>
      <AppText variant="label" style={styles.head}>Getting started · {done} of 3</AppText>
      {steps.map((s, i) => (
        <TouchableOpacity key={i} onPress={s.onPress} disabled={s.done} style={styles.row} accessibilityState={{ checked: s.done }}>
          <IconSymbol name={s.done ? 'checkCircle' : 'chevronRight'} size={18} color={s.done ? Colors.success : world.aura} />
          <AppText variant="body" color={s.done ? Colors.textMuted : Colors.text} style={[styles.flex, s.done && styles.strike]}>{s.label}</AppText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.xs },
  head: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 44, paddingHorizontal: Spacing.lg },
  flex: { flex: 1 },
  strike: { textDecorationLine: 'line-through' },
});
