import { memo, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AppText, IconSymbol } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useWorld } from '@/theme';
import { toDisplay, unitFromProfile } from '@/lib/units';
import type { LoggedSet } from '@/hooks/useWorkout';
import { grid } from './setGrid';
import { EditSetSheet } from './EditSetSheet';

export type SetEdit = { weight: number; reps: number; rpe?: number; note?: string };

/**
 * A logged set: drops to secondary text with a success check. PRs get an
 * inline "PR" chip in aura. memo'd — callbacks take exerciseId so the parent
 * can pass identity-stable handlers straight through.
 */
export const LoggedSetRow = memo(function LoggedSetRow({
  exerciseId,
  set,
  isPR,
  onDelete,
  onEdit,
}: {
  exerciseId: string;
  set: LoggedSet;
  isPR?: boolean;
  onDelete?: (exerciseId: string, localId: string) => void;
  onEdit?: (exerciseId: string, localId: string, data: SetEdit) => void;
}) {
  const world = useWorld();
  const { profile } = useAuth();
  const unit = unitFromProfile(profile?.unit_pref);
  const [editOpen, setEditOpen] = useState(false);
  const label = `${set.weight === 0 ? 'BW' : toDisplay(set.weight, unit)} × ${set.reps}`;

  const handleDelete = () => {
    setEditOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(`Delete set ${set.setNumber}?`, label, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(exerciseId, set.localId) },
    ]);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => onEdit && setEditOpen(true)}
        activeOpacity={onEdit ? 0.65 : 1}
        style={grid.row}
        accessibilityLabel={`Set ${set.setNumber}, ${label}${isPR ? ', personal record' : ''}. Tap to edit.`}
      >
        <AppText variant="label" color={set.isWarmup ? world.auraAlt : Colors.textMuted} style={grid.setNo}>
          {set.isWarmup ? 'W' : set.setNumber}
        </AppText>
        <View style={styles.main}>
          <AppText variant="stat" color={Colors.textSecondary} style={styles.value}>{label}</AppText>
          {set.rpe != null && <AppText variant="caption">@{set.rpe}</AppText>}
          {isPR && (
            <View style={[styles.pr, { backgroundColor: world.aura }]}>
              <AppText variant="label" color={Colors.bg} style={styles.prText}>PR</AppText>
            </View>
          )}
          {set.note ? <AppText variant="caption" numberOfLines={1} style={styles.note}>{set.note}</AppText> : null}
        </View>
        <View style={grid.check}>
          <IconSymbol name="checkCircle" size={22} color={Colors.success} />
        </View>
      </TouchableOpacity>

      <EditSetSheet
        visible={editOpen}
        set={set}
        unit={unit}
        onClose={() => setEditOpen(false)}
        onSave={data => { onEdit?.(exerciseId, set.localId, data); setEditOpen(false); }}
        onDelete={onDelete ? handleDelete : undefined}
      />
    </>
  );
});

const styles = StyleSheet.create({
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  value: { fontSize: 18 },
  pr: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  prText: { fontSize: 12, lineHeight: 16 },
  note: { flex: 1 },
});
