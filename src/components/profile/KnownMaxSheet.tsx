import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { AppText, Button, SheetModal } from '@/components/ui';
import { Colors, Fonts, Hit, Radius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { toLbs, type WeightUnit } from '@/lib/units';

// Both the original seed names and the 017 catalog names exist in the DB.
const LIFTS = [
  { key: 'squat', label: 'Squat', names: ['Barbell Back Squats', 'Barbell Back Squat'] },
  { key: 'bench', label: 'Bench', names: ['Barbell Bench Press'] },
  { key: 'deadlift', label: 'Deadlift', names: ['Deadlifts', 'Deadlift'] },
] as const;

interface Props {
  visible: boolean;
  userId: string;
  unit: WeightUnit;
  onClose: () => void;
  onSaved: () => void;
}

/** "Set a known max" — a tested 1RM per lift, saved as a PR (canonical lbs). */
export function KnownMaxSheet({ visible, userId, unit, onClose, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const entries = LIFTS.filter(l => parseFloat(values[l.key] ?? '') > 0);
    if (entries.length === 0) { Alert.alert('Enter at least one lift'); return; }
    setSaving(true);
    try {
      const { data: rows } = await supabase.from('exercises').select('id, name')
        .in('name', entries.flatMap(e => [...e.names])).eq('is_custom', false);
      for (const e of entries) {
        const ex = e.names.map(n => (rows ?? []).find((r: any) => r.name === n)).find(Boolean) as { id: string } | undefined;
        if (!ex) continue;
        await supabase.from('personal_records').upsert({
          user_id: userId, exercise_id: ex.id, weight: toLbs(parseFloat(values[e.key]), unit), reps: 1,
          achieved_at: new Date().toISOString(),
        }, { onConflict: 'user_id,exercise_id' });
      }
      setValues({});
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetModal visible={visible} onClose={onClose} title="Set a known max">
      <View style={styles.body}>
        <AppText variant="body">A tested single. Your Power Level uses whichever is higher: this or your logged sets.</AppText>
        {LIFTS.map(l => (
          <View key={l.key} style={styles.row}>
            <AppText variant="heading" style={styles.label}>{l.label}</AppText>
            <TextInput
              value={values[l.key] ?? ''}
              onChangeText={v => setValues(prev => ({ ...prev, [l.key]: v.replace(/[^0-9.]/g, '') }))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              accessibilityLabel={`${l.label} max in ${unit}`}
            />
            <AppText variant="label" style={styles.unit}>{unit}</AppText>
          </View>
        ))}
        <Button label="Save maxes" onPress={save} loading={saving} fullWidth size="lg" />
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  label: { width: 80 },
  input: {
    flex: 1, minHeight: Hit.log, backgroundColor: Colors.surface2, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg,
    color: Colors.text, fontFamily: Fonts.hudBold, fontSize: 26, textAlign: 'right',
  },
  unit: { width: 28 },
});
