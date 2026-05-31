import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useWorkoutStore } from '@/hooks/useWorkout';
import { Colors } from '@/constants/colors';
import { RestTimer } from '@/components/workout/RestTimer';
import { ExerciseCard } from '@/components/workout/ExerciseCard';
import { ExercisePickerModal } from '@/components/workout/ExercisePickerModal';
import { TierAdvancementScreen } from '@/components/TierAdvancementScreen';
import { getAnimeTierResult, AnimeTier } from '@/constants/animeTiers';

// PR localId → isPR lookup, built as sets come in
type PRMap = Record<string, boolean>;

export default function WorkoutTab() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const {
    activeWorkout,
    lastSetLoggedAt,
    newPRs,
    startWorkout,
    addExercise,
    removeExercise,
    logSet,
    updateSet,
    deleteSet,
    finishWorkout,
    discardWorkout,
    clearPRs,
  } = useWorkoutStore();

  // Local state
  const [showPicker, setShowPicker] = useState(false);
  const [prMap, setPrMap] = useState<PRMap>({});
  const [finishing, setFinishing] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishNotes, setFinishNotes] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [prevSetsCache, setPrevSetsCache] = useState<Record<string, any[]>>({});
  const [lastWorkoutExercises, setLastWorkoutExercises] = useState<{ id: string; name: string; muscle_group: string }[]>([]);

  // Tier advancement
  const [tierAdvancement, setTierAdvancement] = useState<AnimeTier | null>(null);
  const [showTierAdvancement, setShowTierAdvancement] = useState(false);
  const currentTierRef = useRef<string | null>(null);

  // Smart suggestion + templates
  const [daySuggestion, setDaySuggestion] = useState<{
    name: string;
    dayLabel: string;
    exercises: { id: string; name: string; muscle_group: string; equipment_type?: string }[];
  } | null>(null);
  const [templates, setTemplates] = useState<{
    id: string;
    name: string;
    exercises: { id: string; name: string; muscle_group: string; equipment_type?: string }[];
    muscleGroups: string[];
    lastUsed: string;
  }[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Duration timer
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (activeWorkout) {
      const tick = () => {
        setElapsedSec(Math.floor((Date.now() - activeWorkout.startedAt.getTime()) / 1000));
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedSec(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeWorkout?.id]);

  // Flash PR banner then clear
  useEffect(() => {
    if (newPRs.length > 0) {
      const t = setTimeout(() => clearPRs(), 4000);
      return () => clearTimeout(t);
    }
  }, [newPRs]);

  // ─── LOAD TEMPLATES + DAY SUGGESTION ────────────────────────────────────
  useEffect(() => {
    if (!user || activeWorkout) return;
    setLoadingTemplates(true);
    const todayDow = new Date().getDay();

    supabase
      .from('workouts')
      .select('id, name, started_at, workout_sets(exercises(id, name, muscle_group, equipment_type))')
      .eq('user_id', user.id)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!data) { setLoadingTemplates(false); return; }

        const parseExercises = (w: any) => {
          const seen = new Set<string>();
          const exs: { id: string; name: string; muscle_group: string; equipment_type?: string }[] = [];
          for (const s of w.workout_sets ?? []) {
            const ex = s.exercises;
            if (ex && !seen.has(ex.id)) {
              seen.add(ex.id);
              exs.push({ id: ex.id, name: ex.name, muscle_group: ex.muscle_group, equipment_type: ex.equipment_type });
            }
          }
          return exs;
        };

        // Day suggestion — most recent workout on same day of week
        const sameDayWorkout = data.find(w => new Date(w.started_at).getDay() === todayDow);
        if (sameDayWorkout) {
          const exs = parseExercises(sameDayWorkout);
          if (exs.length > 0) {
            const daysAgo = Math.floor((Date.now() - new Date(sameDayWorkout.started_at).getTime()) / 86400000);
            const label = daysAgo === 7 ? 'Last week' : daysAgo === 14 ? '2 weeks ago' : `${daysAgo}d ago`;
            setDaySuggestion({ name: sameDayWorkout.name, dayLabel: label, exercises: exs });
          }
        }

        // Templates — deduplicate by name, take most recent per name
        const seen = new Map<string, any>();
        for (const w of data) {
          if (!seen.has(w.name)) seen.set(w.name, w);
        }
        const tmpl = Array.from(seen.values()).slice(0, 6).map(w => {
          const exs = parseExercises(w);
          const mgs = [...new Set(exs.map(e => e.muscle_group))];
          return { id: w.id, name: w.name, exercises: exs, muscleGroups: mgs, lastUsed: w.started_at };
        });
        setTemplates(tmpl);

        // Also set last workout exercises for the old repeat feature
        if (data[0]) {
          setLastWorkoutExercises(parseExercises(data[0]));
        }

        setLoadingTemplates(false);
      });
  }, [user, activeWorkout]);

  // ─── START WORKOUT ────────────────────────────────────────────────────────
  const handleStartPress = () => {
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    setWorkoutName(`${day} Workout`);
    setShowNameModal(true);
  };

  const handleRepeatLast = async () => {
    if (!user || lastWorkoutExercises.length === 0) return;
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    setWorkoutName(`${day} Workout`);
    setShowNameModal(true);
  };

  // Start directly from a template — no name modal
  // Seed current tier ref when starting a workout
  // Load saved templates
  const loadSavedTemplates = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('workout_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('last_used_at', { ascending: false, nullsFirst: false });
    setSavedTemplates(data ?? []);
  };

  useEffect(() => {
    if (user && !activeWorkout) loadSavedTemplates();
  }, [user, activeWorkout]);

  const saveTemplate = async (name: string, exercises: any[]) => {
    if (!user || !name.trim() || exercises.length === 0) return;
    await supabase.from('workout_templates').insert({
      user_id: user.id,
      name: name.trim(),
      exercises: exercises.map(e => ({
        id: e.exerciseId,
        name: e.exerciseName,
        muscle_group: e.muscleGroup,
        equipment_type: e.equipmentType,
      })),
    });
    await loadSavedTemplates();
  };

  const deleteTemplate = async (templateId: string) => {
    await supabase.from('workout_templates').delete().eq('id', templateId);
    setSavedTemplates(prev => prev.filter(t => t.id !== templateId));
  };

  const startFromSavedTemplate = async (tmpl: any) => {
    if (!user) return;
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    try {
      await seedCurrentTier();
      await startWorkout(`${day} · ${tmpl.name}`, user.id);
      (tmpl.exercises as any[]).forEach(ex => addExercise({
        id: ex.id, name: ex.name,
        muscle_group: ex.muscle_group,
        equipment_type: ex.equipment_type,
      }));
      // Update last_used_at
      await supabase.from('workout_templates')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', tmpl.id);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const seedCurrentTier = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('personal_records')
      .select('weight, reps, exercises!inner(name)')
      .eq('user_id', user.id)
      .in('exercises.name', ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts']);
    const prs = (data ?? []).map((p: any) => ({
      exerciseName: p.exercises?.name ?? '', weight: p.weight, reps: p.reps,
    }));
    currentTierRef.current = getAnimeTierResult(prs, profile?.bodyweight_lbs ?? 185).animeTier.key;
  };

  const startFromTemplate = async (
    name: string,
    exercises: { id: string; name: string; muscle_group: string; equipment_type?: string }[]
  ) => {
    if (!user) return;
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const wName = `${day} · ${name}`;
    try {
      await seedCurrentTier();
      await startWorkout(wName, user.id);
      exercises.forEach(ex => addExercise({ ...ex, equipment_type: ex.equipment_type }));
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not start workout');
    }
  };

  const handleStartConfirm = async (repeatLast = false) => {
    if (!user || !workoutName.trim()) return;
    setShowNameModal(false);
    try {
      await seedCurrentTier();
      await startWorkout(workoutName.trim(), user.id);
      if (repeatLast && lastWorkoutExercises.length > 0) {
        lastWorkoutExercises.forEach(ex => addExercise(ex));
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not start workout');
    }
  };

  // ─── ADD EXERCISE ─────────────────────────────────────────────────────────
  const handlePickExercise = async (exercise: { id: string; name: string; muscle_group: string }) => {
    addExercise(exercise);
    // Fetch previous session's sets for this exercise for reference hints
    if (user && !prevSetsCache[exercise.id]) {
      const { data } = await supabase
        .from('workout_sets')
        .select('set_number, weight, reps, rpe, note')
        .eq('exercise_id', exercise.id)
        .order('logged_at', { ascending: false })
        .limit(10);
      if (data && data.length > 0) {
        // Take the most recent session's sets (same workout_id = not stored here, so just take first N)
        setPrevSetsCache(prev => ({ ...prev, [exercise.id]: data.slice(0, 6) }));
      }
    }
  };

  // ─── LOG SET ──────────────────────────────────────────────────────────────
  const handleLogSet = async (
    exerciseId: string,
    data: { weight: number; reps: number; rpe?: number; note?: string }
  ) => {
    if (!activeWorkout?.id || !user) return { isPR: false };
    const result = await logSet(exerciseId, data, activeWorkout.id, user.id);

    // Tag the most recently logged set with isPR
    const ex = useWorkoutStore.getState().activeWorkout?.exercises.find(e => e.exerciseId === exerciseId);
    if (ex && ex.sets.length > 0) {
      const lastSet = ex.sets[ex.sets.length - 1];
      setPrMap(prev => ({ ...prev, [lastSet.localId]: result.isPR }));
    }

    // Check for tier advancement on SBD PRs
    if (result.isPR) {
      const SBD_NAMES = ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts'];
      const exName = ex?.exerciseName ?? '';
      if (SBD_NAMES.includes(exName)) {
        const { data: sbdPrs } = await supabase
          .from('personal_records')
          .select('weight, reps, exercises!inner(name)')
          .eq('user_id', user.id)
          .in('exercises.name', SBD_NAMES);

        const prs = (sbdPrs ?? []).map((p: any) => ({
          exerciseName: p.exercises?.name ?? '',
          weight: p.weight, reps: p.reps,
        }));
        const newTierResult = getAnimeTierResult(prs, profile?.bodyweight_lbs ?? 185);
        const newTierKey = newTierResult.animeTier.key;

        if (currentTierRef.current && currentTierRef.current !== newTierKey) {
          // Tier advanced!
          setTierAdvancement(newTierResult.animeTier);
          setShowTierAdvancement(true);
        }
        currentTierRef.current = newTierKey;
      }
    }

    return result;
  };

  // ─── FINISH WORKOUT ───────────────────────────────────────────────────────
  const handleFinishPress = () => {
    if (!activeWorkout) return;
    const totalSets = activeWorkout.exercises.reduce((n, e) => n + e.sets.length, 0);
    if (totalSets === 0) {
      Alert.alert('No sets logged', 'Log at least one set before finishing.');
      return;
    }
    setShowFinishModal(true);
  };

  const handleFinishConfirm = async () => {
    setFinishing(true);
    setShowFinishModal(false);
    try {
      // Save as template if requested
      if (saveAsTemplate && activeWorkout && templateName.trim()) {
        await saveTemplate(templateName.trim(), activeWorkout.exercises);
      }
      setSaveAsTemplate(false);
      setTemplateName('');

      const summary = await finishWorkout(finishNotes.trim() || undefined);
      setFinishNotes('');
      setPrMap({});
      setPrevSetsCache({});
      router.push({ pathname: '/workout/summary', params: { data: JSON.stringify(summary) } });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not finish workout');
    } finally {
      setFinishing(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert(
      'Discard Workout',
      'This will delete the workout and all logged sets. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await discardWorkout();
            setPrMap({});
            setPrevSetsCache({});
          },
        },
      ]
    );
  };

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m < 60) return `${m}:${s.toString().padStart(2, '0')}`;
    const h = Math.floor(m / 60);
    return `${h}:${(m % 60).toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ─── NO ACTIVE WORKOUT ────────────────────────────────────────────────────
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const MUSCLE_COLORS: Record<string, string> = {
    'Chest': '#E91E8C', 'Shoulders': '#9B59B6', 'Triceps': '#8E44AD',
    'Biceps': '#3498DB', 'Mid-Upper Back': '#1ABC9C', 'Lats': '#16A085',
    'Quads': '#E67E22', 'Hamstrings': '#D35400', 'Glutes': '#E74C3C',
    'Core': '#F39C12', 'Overall': Colors.textSecondary,
  };

  if (!activeWorkout) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
          {/* Header */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: Colors.textMuted, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
              {todayName}
            </Text>
            <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -1, marginTop: 2 }}>
              Your arc continues.
            </Text>
          </View>

          {/* Day suggestion */}
          {daySuggestion && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                {daySuggestion.dayLabel} you trained
              </Text>
              <View style={{
                backgroundColor: Colors.surface,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: Colors.accent + '50',
                overflow: 'hidden',
              }}>
                <View style={{ padding: 18 }}>
                  <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '800', marginBottom: 4 }}>
                    {daySuggestion.name}
                  </Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 14 }}>
                    {daySuggestion.exercises.slice(0, 4).map(e => e.name).join(' · ')}
                    {daySuggestion.exercises.length > 4 ? ` +${daySuggestion.exercises.length - 4} more` : ''}
                  </Text>
                  <TouchableOpacity
                    onPress={() => startFromTemplate(daySuggestion.name, daySuggestion.exercises)}
                    style={{
                      backgroundColor: Colors.accent,
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 15, letterSpacing: 0.3 }}>
                      Repeat this session →
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Start blank */}
          <TouchableOpacity
            onPress={handleStartPress}
            style={{
              backgroundColor: daySuggestion ? Colors.surface : Colors.accent,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              marginBottom: 24,
              borderWidth: daySuggestion ? 1 : 0,
              borderColor: Colors.border,
            }}
          >
            <Text style={{
              color: daySuggestion ? Colors.textSecondary : Colors.text,
              fontWeight: '800', fontSize: 15,
            }}>
              {daySuggestion ? '+ Start blank workout' : 'START WORKOUT'}
            </Text>
          </TouchableOpacity>

          {/* Saved templates */}
          {savedTemplates.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>
                  Saved Templates
                </Text>
              </View>
              <View style={{ gap: 10 }}>
                {savedTemplates.map(tmpl => (
                  <TouchableOpacity
                    key={tmpl.id}
                    onPress={() => startFromSavedTemplate(tmpl)}
                    onLongPress={() => Alert.alert(
                      tmpl.name,
                      'Delete this template?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteTemplate(tmpl.id) },
                      ]
                    )}
                    style={{
                      backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
                      borderWidth: 1, borderColor: Colors.accent + '30',
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
                        {tmpl.name}
                      </Text>
                      <View style={{
                        backgroundColor: Colors.accentDim, borderRadius: 8,
                        paddingHorizontal: 10, paddingVertical: 6,
                        borderWidth: 1, borderColor: Colors.accent + '40',
                      }}>
                        <Text style={{ color: Colors.accent, fontWeight: '800', fontSize: 12 }}>Start →</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {(tmpl.exercises as any[]).map((ex: any, i: number) => (
                        <View key={i} style={{
                          backgroundColor: Colors.surface2, borderRadius: 6,
                          paddingHorizontal: 8, paddingVertical: 4,
                        }}>
                          <Text style={{ color: Colors.textSecondary, fontSize: 11 }}>{ex.name}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={{ color: Colors.textMuted, fontSize: 10, marginTop: 8 }}>
                      Long press to delete · {(tmpl.exercises as any[]).length} exercises
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Recent history templates grid */}
          {templates.length > 0 && (
            <>
              <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
                Your templates
              </Text>
              <View style={{ gap: 10 }}>
                {templates.map(tmpl => {
                  const daysAgo = Math.floor((Date.now() - new Date(tmpl.lastUsed).getTime()) / 86400000);
                  const ageLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`;
                  return (
                    <TouchableOpacity
                      key={tmpl.id}
                      onPress={() => startFromTemplate(tmpl.name, tmpl.exercises)}
                      style={{
                        backgroundColor: Colors.surface,
                        borderRadius: 14,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: Colors.border,
                      }}
                    >
                      {/* Header */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
                            {tmpl.name}
                          </Text>
                          <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>
                            {tmpl.exercises.length} exercises · {ageLabel}
                          </Text>
                        </View>
                        <View style={{
                          backgroundColor: Colors.accentDim,
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderWidth: 1,
                          borderColor: Colors.accent + '40',
                        }}>
                          <Text style={{ color: Colors.accent, fontWeight: '800', fontSize: 12 }}>Start →</Text>
                        </View>
                      </View>

                      {/* All exercises */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {tmpl.exercises.map((ex, i) => (
                          <View key={i} style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: Colors.surface2,
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                          }}>
                            <View style={{
                              width: 5, height: 5, borderRadius: 3,
                              backgroundColor: MUSCLE_COLORS[ex.muscle_group] ?? Colors.textMuted,
                            }} />
                            <Text style={{ color: Colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                              {ex.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {loadingTemplates && (
            <ActivityIndicator color={Colors.textMuted} style={{ marginTop: 40 }} />
          )}
        </ScrollView>

        {/* Name modal for blank workouts */}
        <Modal visible={showNameModal} transparent animationType="fade">
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: 'center', padding: 32, backgroundColor: 'rgba(0,0,0,0.7)' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={{
              backgroundColor: Colors.surface,
              borderRadius: 20,
              padding: 24,
              borderWidth: 1,
              borderColor: Colors.border,
            }}>
              <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '800', marginBottom: 16 }}>
                Name this workout
              </Text>
              <TextInput
                value={workoutName}
                onChangeText={setWorkoutName}
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={() => handleStartConfirm(false)}
                style={{
                  backgroundColor: Colors.surface2,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: Colors.text,
                  fontSize: 17,
                  fontWeight: '700',
                  borderWidth: 1,
                  borderColor: Colors.border,
                  marginBottom: 16,
                }}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setShowNameModal(false)}
                  style={{
                    flex: 1, paddingVertical: 14, borderRadius: 12,
                    backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: Colors.textMuted, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleStartConfirm(false)}
                  disabled={!workoutName.trim()}
                  style={{
                    flex: 2, paddingVertical: 14, borderRadius: 12,
                    backgroundColor: workoutName.trim() ? Colors.accent : Colors.surface2,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 15 }}>Let's Go</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    );
  }

  // ─── ACTIVE WORKOUT ───────────────────────────────────────────────────────
  const totalSets = activeWorkout.exercises.reduce((n, e) => n + e.sets.length, 0);
  const totalVolume = activeWorkout.exercises
    .flatMap(e => e.sets)
    .reduce((n, s) => n + s.weight * s.reps, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      {/* Sticky header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.bg,
        gap: 10,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }} numberOfLines={1}>
            {activeWorkout.name}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 3 }}>
            <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {formatElapsed(elapsedSec)}
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
              {totalSets} set{totalSets !== 1 ? 's' : ''}
            </Text>
            {totalVolume > 0 && (
              <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                {totalVolume >= 1000
                  ? `${(totalVolume / 1000).toFixed(1)}k`
                  : totalVolume
                } lbs
              </Text>
            )}
          </View>
        </View>

        {/* Discard */}
        <TouchableOpacity
          onPress={handleDiscard}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: Colors.surface2,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <Text style={{ color: Colors.textMuted, fontSize: 12, fontWeight: '700' }}>Discard</Text>
        </TouchableOpacity>

        {/* Finish */}
        <TouchableOpacity
          onPress={handleFinishPress}
          disabled={finishing}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: Colors.accent,
          }}
        >
          {finishing ? (
            <ActivityIndicator color={Colors.text} size="small" />
          ) : (
            <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '800' }}>FINISH</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Rest timer — appears after first set */}
      <RestTimer lastSetLoggedAt={lastSetLoggedAt} />

      {/* PR Flash Banner */}
      {newPRs.length > 0 && (
        <View style={{
          backgroundColor: Colors.goldDim,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: Colors.gold + '30',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
          <Text style={{ fontSize: 18 }}>🏆</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.gold, fontSize: 13, fontWeight: '900', letterSpacing: 0.3 }}>
              NEW PERSONAL RECORD
            </Text>
            <Text style={{ color: Colors.gold, fontSize: 11, opacity: 0.8, marginTop: 1 }}>
              {newPRs.map(p => `${p.exerciseName} — ${p.weight} × ${p.reps}`).join('  ·  ')}
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {activeWorkout.exercises.length === 0 && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontSize: 15, textAlign: 'center' }}>
              No exercises yet.{'\n'}Add your first lift. Every PR starts here.
            </Text>
          </View>
        )}

        {activeWorkout.exercises.map(exercise => (
          <ExerciseCard
            key={exercise.exerciseId}
            exercise={exercise}
            prevSets={prevSetsCache[exercise.exerciseId] ?? []}
            prMap={prMap}
            workoutId={activeWorkout.id!}
            userId={user!.id}
            onLogSet={handleLogSet}
            onRemove={removeExercise}
            onDeleteSet={deleteSet}
            onEditSet={updateSet}
            onNavigateToDetail={(id) => router.push(`/exercise/${id}`)}
          />
        ))}
      </ScrollView>

      {/* Add Exercise FAB */}
      <View style={{
        position: 'absolute',
        bottom: 32,
        left: 0,
        right: 0,
        alignItems: 'center',
        pointerEvents: 'box-none',
      }}>
        <TouchableOpacity
          onPress={() => setShowPicker(true)}
          style={{
            backgroundColor: Colors.accent,
            borderRadius: 30,
            paddingHorizontal: 28,
            paddingVertical: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            shadowColor: Colors.accent,
            shadowOpacity: 0.4,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}
        >
          <Text style={{ color: Colors.text, fontSize: 22, lineHeight: 24, fontWeight: '300' }}>+</Text>
          <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 }}>
            ADD EXERCISE
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tier Advancement */}
      <TierAdvancementScreen
        visible={showTierAdvancement}
        tier={tierAdvancement}
        onDismiss={() => { setShowTierAdvancement(false); setTierAdvancement(null); }}
      />

      {/* Exercise Picker */}
      <ExercisePickerModal
        visible={showPicker}
        alreadyAdded={activeWorkout.exercises.map(e => e.exerciseId)}
        onSelect={handlePickExercise}
        onClose={() => setShowPicker(false)}
      />

      {/* Finish Modal */}
      <Modal visible={showFinishModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
            activeOpacity={1}
            onPress={() => setShowFinishModal(false)}
          />
          <View style={{
            backgroundColor: Colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
            gap: 16,
          }}>
            <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '900' }}>
              Finish Workout
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              {[
                { label: 'Duration', value: formatElapsed(elapsedSec) },
                { label: 'Sets', value: String(totalSets) },
                { label: 'Volume', value: totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : String(totalVolume) },
              ].map((s, i) => (
                <View key={i} style={{
                  flex: 1,
                  backgroundColor: Colors.surface2,
                  borderRadius: 12,
                  padding: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>{s.label}</Text>
                  <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '800', marginTop: 4 }}>{s.value}</Text>
                </View>
              ))}
            </View>

            <TextInput
              value={finishNotes}
              onChangeText={setFinishNotes}
              placeholder="Session notes (optional)..."
              placeholderTextColor={Colors.textMuted}
              multiline
              style={{
                backgroundColor: Colors.surface2,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: Colors.text,
                fontSize: 14,
                minHeight: 60,
                maxHeight: 120,
                textAlignVertical: 'top',
                borderWidth: 1,
                borderColor: Colors.border,
                lineHeight: 20,
              }}
            />

            {/* Save as template toggle */}
            <TouchableOpacity
              onPress={() => {
                setSaveAsTemplate(!saveAsTemplate);
                if (!saveAsTemplate) setTemplateName(activeWorkout?.name ?? '');
              }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: saveAsTemplate ? Colors.accentDim : Colors.surface2,
                borderRadius: 12, padding: 14,
                borderWidth: 1, borderColor: saveAsTemplate ? Colors.accent + '40' : Colors.border,
              }}
            >
              <View style={{
                width: 22, height: 22, borderRadius: 6,
                backgroundColor: saveAsTemplate ? Colors.accent : Colors.surface,
                borderWidth: 1, borderColor: saveAsTemplate ? Colors.accent : Colors.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {saveAsTemplate && <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '900' }}>✓</Text>}
              </View>
              <Text style={{ color: saveAsTemplate ? Colors.text : Colors.textMuted, fontWeight: '600', flex: 1 }}>
                Save as template
              </Text>
            </TouchableOpacity>

            {saveAsTemplate && (
              <TextInput
                value={templateName}
                onChangeText={setTemplateName}
                placeholder="Template name (e.g. Push Day)"
                placeholderTextColor={Colors.textMuted}
                style={{
                  backgroundColor: Colors.surface2, borderRadius: 12,
                  paddingHorizontal: 14, paddingVertical: 12,
                  color: Colors.text, fontSize: 15,
                  borderWidth: 1, borderColor: Colors.border,
                }}
              />
            )}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowFinishModal(false)}
                style={{
                  flex: 1, paddingVertical: 16, borderRadius: 14,
                  backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: Colors.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleFinishConfirm}
                style={{ flex: 2, paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.accent, alignItems: 'center' }}
              >
                <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 16 }}>SAVE WORKOUT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
