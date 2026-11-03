import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppText, Button, SheetModal } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { toDisplay, toLbs, type WeightUnit } from '@/lib/units';
import type { LoggedSet } from '@/hooks/useWorkout';
import { grid } from './setGrid';
import type { SetEdit } from './LoggedSetRow';

interface Props {
  visible: boolean;
  set: LoggedSet;
  unit: WeightUnit;
  onClose: () => void;
  onSave: (data: SetEdit) => void;
  onDelete?: () => void;
}

export function EditSetSheet({ visible, set, unit, onClose, onSave, onDelete }: Props) {
  const [weight, setWeight] = useState(String(toDisplay(set.weight, unit)));
  const [reps, setReps] = useState(String(set.reps));
  const [note, setNote] = useState(set.note ?? '');

  // Re-seed whenever the sheet opens so it always reflects the stored set.
  useEffect(() => {
    if (!visible) return;
    setWeight(String(toDisplay(set.weight, unit)));
    setReps(String(set.reps));
    setNote(set.note ?? '');
  }, [visible]);

  const save = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    // weight 0 is a valid bodyweight set — only reject NaN/negative
    if (isNaN(w) || w < 0 || !r) return;
    onSave({ weight: toLbs(w, unit), reps: r, rpe: set.rpe, note: note.trim() || undefined });
  };

  return (
    <SheetModal visible={visible} onClose={onClose} title={`Edit set ${set.setNumber}`}>
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppText variant="label">Weight ({unit})</AppText>
            <TextInput value={weight} onChangeText={setWeight} keyboardType="decimal-pad" selectTextOnFocus style={grid.input} />
          </View>
          <View style={styles.flex}>
            <AppText variant="label">Reps</AppText>
            <TextInput value={reps} onChangeText={setReps} keyboardType="number-pad" selectTextOnFocus style={grid.input} />
          </View>
        </View>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
          placeholderTextColor={Colors.textMuted}
          style={styles.note}
        />
        <Button label="Save set" onPress={save} fullWidth size="lg" />
        {onDelete && <Button label="Delete set" variant="danger" onPress={onDelete} fullWidth />}
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  flex: { flex: 1, gap: Spacing.xs },
  note: {
    backgroundColor: Colors.surface2, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, minHeight: 48,
    color: Colors.text, fontFamily: Fonts.body, fontSize: 15,
  },
});
