import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { AppText, Button, IconSymbol } from '@/components/ui';
import { Colors, Fonts, Hit, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { supabase } from '@/lib/supabase';

export const MUSCLE_GROUPS = [
  'All', 'Chest', 'Shoulders', 'Triceps', 'Biceps',
  'Mid-Upper Back', 'Lats', 'Quads', 'Hamstrings', 'Glutes',
  'Core', 'Calves', 'Forearms', 'Overall',
];
const EQUIPMENT_OPTIONS = ['Barbell', 'Dumbbells', 'Cable Machine', 'Machine', 'Bodyweight', 'Kettlebell', 'Resistance Band', 'Other'];

export function ChipRow({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const world = useWorld();
  return (
    <View style={styles.chips}>
      {options.map(o => (
        <TouchableOpacity
          key={o}
          onPress={() => onChange(o)}
          accessibilityState={{ selected: value === o }}
          style={[styles.chip, value === o && { backgroundColor: world.aura + '1F', borderColor: world.aura }]}
        >
          <AppText variant="label" color={value === o ? world.aura : Colors.textSecondary}>{o}</AppText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface Props {
  userId: string;
  initialName: string;
  onBack: () => void;
  onCreated: (ex: { id: string; name: string; muscle_group: string; equipment_type?: string | null; secondary_muscle?: string | null }) => void;
}

/** Inline "New exercise" view inside the picker (no nested modal). */
export function CreateExerciseForm({ userId, initialName, onBack, onCreated }: Props) {
  const [name, setName] = useState(initialName);
  const [group, setGroup] = useState('');
  const [equipment, setEquipment] = useState('Barbell');
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!name.trim() || !group) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('exercises')
        .insert({ name: name.trim(), muscle_group: group, equipment_type: equipment, is_custom: true, created_by: userId, form_cues: null })
        .select()
        .single();
      if (error) throw error;
      onCreated(data);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <TouchableOpacity onPress={onBack} style={styles.back} accessibilityLabel="Back">
          <IconSymbol name="chevronBack" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <AppText variant="title">New exercise</AppText>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <AppText variant="label">Name</AppText>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            placeholder="e.g. Cable pull-through"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <AppText variant="label">Muscle group</AppText>
          <ChipRow options={MUSCLE_GROUPS.filter(g => g !== 'All')} value={group} onChange={setGroup} />
        </View>
        <View style={styles.field}>
          <AppText variant="label">Equipment</AppText>
          <ChipRow options={EQUIPMENT_OPTIONS} value={equipment} onChange={setEquipment} />
        </View>
        <Button label="Create and add" onPress={create} disabled={!name.trim() || !group} loading={creating} size="lg" fullWidth />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.md },
  back: { width: Hit.min, height: Hit.min, alignItems: 'center', justifyContent: 'center', marginLeft: -Spacing.md },
  body: { gap: Spacing.xl, paddingBottom: Spacing.xl },
  field: { gap: Spacing.sm },
  input: {
    backgroundColor: Colors.surface2, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.lg, minHeight: Hit.log, color: Colors.text, fontFamily: Fonts.bodySemi, fontSize: 17,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    minHeight: 36, paddingHorizontal: Spacing.md, justifyContent: 'center',
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
});
