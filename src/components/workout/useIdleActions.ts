import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { StarterProgramDay } from '@/constants/starterPrograms';
import type { DaySuggestion } from '@/hooks/useWorkoutTemplates';

type Ex = { id: string; name: string; muscle_group: string; equipment_type?: string };

interface Deps {
  userId: string | undefined;
  daySuggestion: DaySuggestion | null;
  setDaySuggestion: (fn: (prev: DaySuggestion | null) => DaySuggestion | null) => void;
  refetchTemplates: () => Promise<any> | void;
  /** Start a named session with these exercises (seeds power, notifies, etc.) */
  startWith: (name: string, exercises: Ex[], opts?: { templateId?: string }) => Promise<void>;
}

const today = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });

/** Idle-screen actions: templates, starter days, pin/unpin. */
export function useIdleActions({ userId, daySuggestion, setDaySuggestion, refetchTemplates, startWith }: Deps) {
  const saveTemplate = async (name: string, exercises: { exerciseId: string; exerciseName: string; muscleGroup: string; equipmentType?: string }[]) => {
    if (!userId || !name.trim() || exercises.length === 0) return;
    await supabase.from('workout_templates').insert({
      user_id: userId,
      name: name.trim(),
      exercises: exercises.map(e => ({ id: e.exerciseId, name: e.exerciseName, muscle_group: e.muscleGroup, equipment_type: e.equipmentType })),
    });
    await refetchTemplates();
  };

  const deleteTemplate = async (templateId: string) => {
    await supabase.from('workout_templates').delete().eq('id', templateId);
    refetchTemplates();
  };

  const startFromTemplate = (name: string, exercises: Ex[]) => startWith(`${today()} · ${name}`, exercises);

  const startFromSavedTemplate = async (tmpl: any) => {
    await startWith(`${today()} · ${tmpl.name}`, (tmpl.exercises as any[]).map(ex => ({
      id: ex.id, name: ex.name, muscle_group: ex.muscle_group, equipment_type: ex.equipment_type,
    })));
    await supabase.from('workout_templates').update({ last_used_at: new Date().toISOString() }).eq('id', tmpl.id);
  };

  // Resolve a starter day's exercise names to library ids, then reuse the
  // template start path so the whole flow behaves identically.
  const startStarterDay = async (day: StarterProgramDay) => {
    const { data } = await supabase
      .from('exercises').select('id, name, muscle_group, equipment_type')
      .in('name', day.exerciseNames).eq('is_custom', false);
    const byName = new Map((data ?? []).map((e: any) => [e.name.toLowerCase(), e]));
    const resolved = day.exerciseNames.map(n => byName.get(n.toLowerCase())).filter(Boolean) as Ex[];
    if (resolved.length === 0) {
      Alert.alert('Error', 'Could not load the program exercises. Check your connection and try again.');
      return;
    }
    await startFromTemplate(day.name, resolved);
  };

  const pinSuggestion = () => {
    if (!daySuggestion) return;
    const dayName = today();
    Alert.alert(`Pin as ${dayName} template?`, `Every ${dayName}, this workout will be your default suggestion.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: `Pin for ${dayName}`,
        onPress: async () => {
          if (!userId) return;
          await supabase.from('workout_templates').insert({
            user_id: userId, name: daySuggestion.name, exercises: daySuggestion.exercises as any, day_of_week: new Date().getDay(),
          });
          setDaySuggestion(prev => (prev ? { ...prev, isPinned: true, dayLabel: `Your ${dayName} plan` } : null));
        },
      },
    ]);
  };

  const unpinSuggestion = () => {
    if (!daySuggestion?.pinnedTemplateId) return;
    Alert.alert('Unpin?', 'Remove this as your pinned template for this day?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unpin', style: 'destructive', onPress: async () => {
          await supabase.from('workout_templates').update({ day_of_week: null }).eq('id', daySuggestion.pinnedTemplateId!);
          setDaySuggestion(() => null);
        },
      },
    ]);
  };

  return { saveTemplate, deleteTemplate, startFromTemplate, startFromSavedTemplate, startStarterDay, pinSuggestion, unpinSuggestion };
}
