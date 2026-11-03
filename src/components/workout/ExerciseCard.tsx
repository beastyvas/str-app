import { memo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText, IconSymbol } from '@/components/ui';
import { Colors, Hit, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useWorld } from '@/theme';
import { toDisplay, unitFromProfile } from '@/lib/units';
import type { WorkoutExercise, LoggedSet } from '@/hooks/useWorkout';
import { SetInputRow } from './SetInputRow';
import { LoggedSetRow, type SetEdit } from './LoggedSetRow';

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  prevSets?: LoggedSet[];
  prMap?: Record<string, boolean>;
  workoutId: string;
  userId: string;
  onLogSet: (
    exerciseId: string,
    data: { weight: number; reps: number; rpe?: number; note?: string }
  ) => Promise<{ isPR: boolean }>;
  onRemove: (exerciseId: string) => void;
  onReplace: (exerciseId: string) => void;
  onDeleteSet: (exerciseId: string, localId: string) => void;
  onEditSet: (exerciseId: string, localId: string, data: SetEdit) => void;
  onNavigateToDetail: (exerciseId: string) => void;
  /** 'first' | 'second' when this card is half of a superset pair */
  supersetRole?: 'first' | 'second' | null;
  /** Pairing with the next card is possible (or this card can unlink) */
  canToggleSuperset?: boolean;
  onToggleSuperset?: (exerciseId: string) => void;
}

const EMPTY: LoggedSet[] = [];
const EMPTY_MAP: Record<string, boolean> = {};

// memo: the workout screen re-renders on every store change; each card only
// cares about its own exercise slice + identity-stable callbacks.
export const ExerciseCard = memo(function ExerciseCard({
  exercise,
  prevSets = EMPTY,
  prMap = EMPTY_MAP,
  onLogSet,
  onRemove,
  onReplace,
  onDeleteSet,
  onEditSet,
  supersetRole = null,
  canToggleSuperset = false,
  onToggleSuperset,
  onNavigateToDetail,
}: ExerciseCardProps) {
  const world = useWorld();
  const { profile } = useAuth();
  const unit = unitFromProfile(profile?.unit_pref);
  const [collapsed, setCollapsed] = useState(false);
  const id = exercise.exerciseId;

  const lastTime = prevSets.length
    ? 'Last time: ' + prevSets.slice(0, 4).map(s => `${s.weight === 0 ? 'BW' : toDisplay(s.weight, unit)} × ${s.reps}`).join(', ')
      + (prevSets.length > 4 ? '…' : '')
    : null;

  const confirmRemove = () => Alert.alert('Remove exercise', `Remove ${exercise.exerciseName} from this workout?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => onRemove(id) },
  ]);

  // One quiet overflow instead of four icon buttons on every card.
  const openMenu = () => {
    const actions: { label: string; run: () => void; destructive?: boolean }[] = [
      { label: 'Exercise details', run: () => onNavigateToDetail(id) },
      { label: 'Replace exercise', run: () => onReplace(id) },
    ];
    if (canToggleSuperset) actions.push({ label: supersetRole ? 'Unlink superset' : 'Superset with next', run: () => onToggleSuperset?.(id) });
    actions.push({ label: 'Remove exercise', run: confirmRemove, destructive: true });
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: exercise.exerciseName,
          options: [...actions.map(a => a.label), 'Cancel'],
          cancelButtonIndex: actions.length,
          destructiveButtonIndex: actions.findIndex(a => a.destructive),
          userInterfaceStyle: 'dark',
        },
        i => { if (i < actions.length) actions[i].run(); },
      );
    } else {
      Alert.alert(exercise.exerciseName, undefined, [
        ...actions.map(a => ({ text: a.label, onPress: a.run, style: a.destructive ? 'destructive' as const : 'default' as const })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  return (
    <View style={[styles.card, supersetRole === 'first' && styles.pairedTop]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCollapsed(c => !c)} style={styles.titleBtn} accessibilityLabel={`${exercise.exerciseName}, ${collapsed ? 'expand' : 'collapse'}`}>
          <View style={styles.titleRow}>
            <AppText variant="heading" numberOfLines={1} style={styles.flexShrink}>{exercise.exerciseName}</AppText>
            {supersetRole && (
              <AppText variant="caption" color={world.aura}>Superset {supersetRole === 'first' ? 'A' : 'B'}</AppText>
            )}
          </View>
          {lastTime && <AppText variant="caption" numberOfLines={1}>{lastTime}</AppText>}
        </TouchableOpacity>
        <TouchableOpacity onPress={openMenu} style={styles.menu} accessibilityLabel={`${exercise.exerciseName} options`}>
          <IconSymbol name="ellipsis" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {!collapsed && (
        <>
          {exercise.sets.map(s => (
            <LoggedSetRow
              key={s.localId}
              exerciseId={id}
              set={s}
              isPR={prMap[s.localId]}
              onDelete={onDeleteSet}
              onEdit={onEditSet}
            />
          ))}
          <SetInputRow
            setNumber={exercise.sets.length + 1}
            prevSet={prevSets[exercise.sets.length]}
            equipmentType={exercise.equipmentType}
            onLog={data => onLogSet(id, data)}
          />
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.screenH,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  pairedTop: { marginBottom: Spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: Spacing.lg, paddingVertical: Spacing.sm },
  titleBtn: { flex: 1, gap: 2, minHeight: Hit.min, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flexShrink: { flexShrink: 1 },
  menu: { width: Hit.min + 4, height: Hit.min, alignItems: 'center', justifyContent: 'center' },
});
