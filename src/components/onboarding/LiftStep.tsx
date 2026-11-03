import { StyleSheet, TextInput, View } from 'react-native';
import { AppText, Button, IconSymbol, PressableScale } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import type { CanonicalLift } from '@/lib/powerLevel';
import { Chip } from './Chip';
import { ob } from './styles';

export interface LiftEntry { lift: CanonicalLift; weight: string; reps: string }

const LABEL: Record<CanonicalLift, string> = { squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift' };
const ALL: CanonicalLift[] = ['squat', 'bench', 'deadlift'];

interface Props {
  entries: LiftEntry[];
  unit: 'lbs' | 'kg';
  saving: boolean;
  onChange: (entries: LiftEntry[]) => void;
  onFinish: () => void;
  onSkip: () => void;
}

export const entryValid = (e: LiftEntry) => {
  const w = parseFloat(e.weight);
  const r = parseInt(e.reps, 10);
  return w > 0 && r >= 1 && r <= 10;
};

/**
 * 3 · "One lift you know" — a recent set (weight × reps), not a 1RM.
 * Everyone knows "I did 185 for 5". Up to all three lifts.
 */
export function LiftStep({ entries, unit, saving, onChange, onFinish, onSkip }: Props) {
  const world = useWorld();
  const used = entries.map(e => e.lift);
  const free = ALL.filter(l => !used.includes(l));
  const update = (i: number, patch: Partial<LiftEntry>) =>
    onChange(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const tooManyReps = entries.some(e => parseInt(e.reps, 10) > 10);
  const ready = entries.length > 0 && entries.every(entryValid);

  return (
    <View style={ob.step}>
      <View style={ob.head}>
        <AppText variant="display">One lift you know</AppText>
        <AppText variant="body">A recent set is enough — like 185 for 5. No max needed.</AppText>
      </View>

      {entries.map((e, i) => (
        <View key={e.lift} style={ob.field}>
          <View style={ob.segment}>
            {ALL.map(l => (
              <Chip
                key={l}
                label={LABEL[l]}
                selected={e.lift === l}
                onPress={() => { if (l === e.lift || !used.includes(l)) update(i, { lift: l }); }}
              />
            ))}
          </View>
          <View style={styles.setRow}>
            <View style={[ob.inputRow, styles.flex]}>
              <TextInput
                value={e.weight}
                onChangeText={v => update(i, { weight: v.replace(/[^0-9.]/g, '') })}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                maxLength={5}
                style={styles.num}
                accessibilityLabel={`${LABEL[e.lift]} weight in ${unit}`}
              />
              <AppText variant="label" style={styles.unit}>{unit}</AppText>
            </View>
            <AppText variant="stat" color={Colors.textMuted}>×</AppText>
            <View style={[ob.inputRow, styles.reps]}>
              <TextInput
                value={e.reps}
                onChangeText={v => update(i, { reps: v.replace(/[^0-9]/g, '') })}
                placeholder="5"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={2}
                style={styles.num}
                accessibilityLabel={`${LABEL[e.lift]} reps`}
              />
            </View>
            {entries.length > 1 && (
              <PressableScale onPress={() => onChange(entries.filter((_, j) => j !== i))} style={styles.remove} accessibilityLabel="Remove lift">
                <IconSymbol name="close" size={18} color={Colors.textMuted} />
              </PressableScale>
            )}
          </View>
        </View>
      ))}

      {tooManyReps && <AppText variant="caption" color={Colors.danger}>Use a set of 10 reps or fewer.</AppText>}

      {free.length > 0 && (
        <PressableScale onPress={() => onChange([...entries, { lift: free[0], weight: '', reps: '' }])} style={styles.add}>
          <IconSymbol name="add" size={18} color={world.aura} />
          <AppText variant="heading" color={world.aura}>Add another lift</AppText>
        </PressableScale>
      )}

      <View style={ob.footer}>
        <Button label="Get my Power Level" size="lg" fullWidth onPress={onFinish} disabled={!ready} loading={saving} haptic="medium" />
        <Button label="I don't know yet" variant="ghost" size="md" fullWidth onPress={onSkip} disabled={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  setRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  reps: { width: 84 },
  num: { flex: 1, color: Colors.text, fontFamily: Fonts.hudBold, fontSize: 28, minHeight: 56 },
  unit: { paddingRight: Spacing.lg },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 44 },
});
