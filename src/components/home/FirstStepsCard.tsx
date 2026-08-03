import { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppText, Card, IconSymbol, IconName } from '@/components/ui';
import { FirstSteps } from '@/hooks/useHomeData';

// Restyle ONLY — the three tasks, their order, and their completion semantics
// are the Apple-reviewed activation flow. Do not change what marks steps done.

interface FirstStepsCardProps {
  firstSteps: FirstSteps;
  isNewLifter: boolean;
  onStartFirstWorkout: () => void;
  onCoachStep: () => void;
  onAddFriend: () => void;
}

function StepRow({
  done, icon, title, sub, last, onPress,
}: {
  done: boolean;
  icon: IconName;
  title: string;
  sub: ReactNode;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.stepRow, !last && styles.stepDivider, done && styles.stepDone]}
    >
      <View style={[styles.stepBadge, done && styles.stepBadgeDone]}>
        <IconSymbol name={done ? 'check' : icon} size={14} color={done ? Colors.success : Colors.textSecondary} />
      </View>
      <View style={styles.stepText}>
        <AppText
          variant="caption"
          color={Colors.text}
          style={[styles.stepTitle, done && styles.strike]}
        >
          {title}
        </AppText>
        <AppText variant="micro" style={styles.stepSub}>{sub}</AppText>
      </View>
      {!done && <IconSymbol name="chevronRight" size={14} color={Colors.accent} />}
    </TouchableOpacity>
  );
}

export function FirstStepsCard({
  firstSteps, isNewLifter, onStartFirstWorkout, onCoachStep, onAddFriend,
}: FirstStepsCardProps) {
  const doneCount = [firstSteps.hasWorkout, firstSteps.hasFriend, firstSteps.hasCoach].filter(Boolean).length;

  return (
    <View style={styles.wrap}>
      <Card padding="none" style={{ borderColor: Colors.accent + '30' }}>
        <View style={styles.header}>
          <IconSymbol name="target" size={18} color={Colors.accent} />
          <View style={styles.headerText}>
            <AppText variant="caption" color={Colors.text} style={styles.headerTitle}>Getting Started</AppText>
            <AppText variant="micro">{doneCount} of 3 complete</AppText>
          </View>
          <View style={styles.dots}>
            {[firstSteps.hasWorkout, firstSteps.hasFriend, firstSteps.hasCoach].map((done, i) => (
              <View key={i} style={[styles.dot, done ? styles.dotDone : styles.dotPending]} />
            ))}
          </View>
        </View>

        <StepRow
          done={firstSteps.hasWorkout}
          icon="lift"
          title="Log your first workout"
          sub="Track sets, reps, and weight"
          onPress={onStartFirstWorkout}
        />
        <StepRow
          done={firstSteps.hasCoach}
          icon="flash"
          title={isNewLifter ? 'Ask your coach anything' : 'Get your weekly plan from Coach'}
          sub={isNewLifter ? 'Nervous questions welcome — 5 free a week' : 'AI builds a program around your goals'}
          onPress={onCoachStep}
        />
        <StepRow
          done={firstSteps.hasFriend}
          icon="people"
          title="Add your first friend"
          sub={<>Tap to add <AppText variant="micro" color={Colors.accent}>@beastyvas</AppText> — the creator 👑</>}
          last
          onPress={onAddFriend}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md + 2 },
  header: {
    padding: Spacing.md, paddingHorizontal: Spacing.lg - 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  headerText: { flex: 1, gap: 1 },
  headerTitle: { fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotDone: { backgroundColor: Colors.accent },
  dotPending: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, paddingHorizontal: Spacing.lg - 4,
  },
  stepDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  stepDone: { opacity: 0.5 },
  stepBadge: {
    width: 28, height: 28, borderRadius: Radius.pill,
    backgroundColor: Colors.surface2,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeDone: { backgroundColor: Colors.success + '20', borderColor: Colors.success },
  stepText: { flex: 1, gap: 1 },
  stepTitle: { fontWeight: '700' },
  stepSub: {},
  strike: { textDecorationLine: 'line-through' },
});
