import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppText, Button, IconSymbol } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ExercisePickerModal } from './ExercisePickerModal';
import { TemplateExercise } from '@/hooks/useWorkoutTemplates';

interface TemplateBuilderSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful save so the caller can refresh its lists */
  onSaved: () => void;
}

/**
 * Full-height template builder. Stays an iOS pageSheet (it's an editor with
 * keyboard + a nested picker, not a bottom sheet) — contents on primitives.
 */
export function TemplateBuilderSheet({ visible, onClose, onSaved }: TemplateBuilderSheetProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<TemplateExercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fresh form each open
  useEffect(() => {
    if (visible) { setName(''); setExercises([]); }
  }, [visible]);

  const save = async () => {
    if (!name.trim()) { Alert.alert('Add a name'); return; }
    if (exercises.length === 0) { Alert.alert('Add at least one exercise'); return; }
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from('workout_templates').insert({
        user_id: user.id,
        name: name.trim(),
        exercises: exercises as any,
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <AppText variant="title" style={styles.headerTitle}>New Template</AppText>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppText variant="caption" style={styles.cancel}>Cancel</AppText>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Template name (e.g. Push Day, Leg Day...)"
            placeholderTextColor={Colors.textMuted}
            autoFocus
            style={styles.nameInput}
          />

          {exercises.length > 0 && (
            <View style={styles.exList}>
              {exercises.map((ex, i) => (
                <View key={i} style={styles.exRow}>
                  <View style={styles.exText}>
                    <AppText variant="caption" color={Colors.text} style={styles.exName}>{ex.name}</AppText>
                    <AppText variant="micro">{ex.muscle_group}</AppText>
                  </View>
                  <TouchableOpacity
                    onPress={() => setExercises(prev => prev.filter((_, idx) => idx !== i))}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <IconSymbol name="close" size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.addBtn}>
            <IconSymbol name="add" size={18} color={Colors.textMuted} />
            <AppText variant="caption" style={styles.addText}>Add Exercise</AppText>
          </TouchableOpacity>

          <Button
            label={`Save Template (${exercises.length} exercises)`}
            onPress={save}
            loading={saving}
            disabled={!name.trim() || exercises.length === 0}
            fullWidth
            size="lg"
          />
        </ScrollView>
      </SafeAreaView>

      <ExercisePickerModal
        visible={showPicker}
        alreadyAdded={exercises.map(e => e.id)}
        onSelect={(ex: any) => {
          setExercises(prev => [...prev, {
            id: ex.id, name: ex.name,
            muscle_group: ex.muscle_group,
            equipment_type: ex.equipment_type,
          }]);
          setShowPicker(false);
        }}
        onClose={() => setShowPicker(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.screenH, paddingVertical: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 18 },
  cancel: { fontWeight: '700' },
  content: { padding: Spacing.screenH, gap: Spacing.lg },
  nameInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md + 2,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md + 2,
    color: Colors.text, fontSize: 17, fontWeight: '700',
    borderWidth: 1, borderColor: Colors.border,
  },
  exList: { gap: Spacing.sm },
  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.md + 2, padding: Spacing.md + 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  exText: { flex: 1, gap: 1 },
  exName: { fontWeight: '700' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface2, borderRadius: Radius.md + 2, padding: Spacing.md + 2,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
  },
  addText: { fontWeight: '600' },
});
