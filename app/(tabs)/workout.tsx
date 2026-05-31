import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Animated, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useWorkoutStore } from '@/hooks/useWorkout';
import { Colors } from '@/constants/colors';
import { RestTimer } from '@/components/workout/RestTimer';
import { ExerciseCard } from '@/components/workout/ExerciseCard';
import { ExercisePickerModal } from '@/components/workout/ExercisePickerModal';
import { TierAdvancementScreen } from '@/components/TierAdvancementScreen';
import { FirstWorkoutTooltip } from '@/components/workout/FirstWorkoutTooltip';
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
  const [finishPhoto, setFinishPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [builderName, setBuilderName] = useState('');
  const [builderExercises, setBuilderExercises] = useState<any[]>([]);
  const [showBuilderPicker, setShowBuilderPicker] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [prevSetsCache, setPrevSetsCache] = useState<Record<string, any[]>>({});
  const [lastWorkoutExercises, setLastWorkoutExercises] = useState<{ id: string; name: string; muscle_group: string }[]>([]);

  // First workout tutorial
  const [isFirstWorkout, setIsFirstWorkout] = useState(false);
  type TutorialStep = 'add_exercise' | 'log_set' | 'finish' | 'done';
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('add_exercise');

  // Tier advancement
  const [tierAdvancement, setTierAdvancement] = useState<AnimeTier | null>(null);
  const [tierAdvSubTier, setTierAdvSubTier] = useState<number | undefined>(undefined);
  const [isSubTierAdvance, setIsSubTierAdvance] = useState(false);
  const [showTierAdvancement, setShowTierAdvancement] = useState(false);
  // Track { key, subTier, minScore } so we can detect advancement vs regression
  const currentTierRef = useRef<{ key: string; subTier: number; minScore: number } | null>(null);

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

  // Auto-start first workout when coming from First Steps task
  useFocusEffect(useCallback(() => {
    if ((global as any).__startFirstWorkout && !activeWorkout && user) {
      (global as any).__startFirstWorkout = false;
      const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      setWorkoutName(`${day} Workout`);
      setShowNameModal(true);
    }
  }, [activeWorkout, user]));

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
      .eq('user_id', user.id);
    const prs = (data ?? []).map((p: any) => ({
      exerciseName: p.exercises?.name ?? '', weight: p.weight, reps: p.reps,
    }));
    const result = getAnimeTierResult(prs, profile?.bodyweight_lbs ?? 185);
    currentTierRef.current = {
      key: result.animeTier.key,
      subTier: result.subTier,
      minScore: result.animeTier.minScore,
    };
  };

  const checkFirstWorkout = async () => {
    if (!user) return;
    const { count } = await supabase
      .from('workouts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('ended_at', 'is', null);
    if ((count ?? 0) === 0) {
      setIsFirstWorkout(true);
      setTutorialStep('add_exercise');
    }
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
      await checkFirstWorkout();
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
    if (isFirstWorkout && tutorialStep === 'add_exercise') {
      setTutorialStep('log_set');
    }
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

    // Advance first workout tutorial
    if (isFirstWorkout && tutorialStep === 'log_set') {
      setTutorialStep('finish');
    }

    // Tag the most recently logged set with isPR
    const ex = useWorkoutStore.getState().activeWorkout?.exercises.find(e => e.exerciseId === exerciseId);
    if (ex && ex.sets.length > 0) {
      const lastSet = ex.sets[ex.sets.length - 1];
      setPrMap(prev => ({ ...prev, [lastSet.localId]: result.isPR }));
    }

    // Check for tier/sub-tier advancement on SBD PRs
    if (result.isPR) {
      const SBD_NAMES = ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts'];
      const exName = ex?.exerciseName ?? '';
      if (SBD_NAMES.some(n => exName.toLowerCase() === n.toLowerCase())) {
        // Fetch ALL PRs (filter to SBD inside getAnimeTierResult)
        const { data: allPrs } = await supabase
          .from('personal_records')
          .select('weight, reps, exercises!inner(name)')
          .eq('user_id', user.id);

        const prs = (allPrs ?? []).map((p: any) => ({
          exerciseName: p.exercises?.name ?? '',
          weight: p.weight, reps: p.reps,
        }));
        const newResult = getAnimeTierResult(prs, profile?.bodyweight_lbs ?? 185);
        const newKey = newResult.animeTier.key;
        const newMinScore = newResult.animeTier.minScore;
        const newSubTier = newResult.subTier;

        const prev = currentTierRef.current as any;
        const thisLift = newResult.lifts.find(l => l.exercise.toLowerCase() === exName.toLowerCase());
        const SBD_KEY: Record<string, string> = {
          'barbell back squats': 'sqTier',
          'barbell bench press': 'bpTier',
          'deadlifts': 'dlTier',
        };
        const prevLiftTierKey = SBD_KEY[exName.toLowerCase()];
        const prevLiftTier = prev?.[prevLiftTierKey] ?? 'beginner';
        const TIER_COLORS_INLINE: Record<string, string> = {
          beginner: Colors.tiers.beginner, bronze: Colors.tiers.bronze,
          silver: Colors.tiers.silver, gold: Colors.tiers.gold,
          platinum: Colors.tiers.platinum, diamond: Colors.tiers.diamond,
        };

        if (!prev) {
          // First ever SBD PR — always fire
          setTierAdvancement(newResult.animeTier);
          setTierAdvSubTier(newSubTier);
          setIsSubTierAdvance(false);
          setShowTierAdvancement(true);
        } else if (newMinScore > prev.minScore) {
          // Full overall rank advance
          setTierAdvancement(newResult.animeTier);
          setTierAdvSubTier(undefined);
          setIsSubTierAdvance(false);
          setShowTierAdvancement(true);
        } else if (newKey === prev.key && newSubTier > prev.subTier) {
          // Sub-tier advance within same rank
          setTierAdvancement(newResult.animeTier);
          setTierAdvSubTier(newSubTier);
          setIsSubTierAdvance(true);
          setShowTierAdvancement(true);
        } else if (thisLift && thisLift.tier !== prevLiftTier && thisLift.tier !== 'beginner') {
          // Individual lift tier advanced (squat/bench/deadlift tier went up)
          // even if the overall weakest-link rank didn't change yet
          const liftLabel = exName.replace('Barbell ', '').replace(' Squats', ' Squat').toUpperCase();
          const tierLabel = (thisLift.tier.charAt(0).toUpperCase() + thisLift.tier.slice(1)).toUpperCase();
          const liftColor = TIER_COLORS_INLINE[thisLift.tier];
          // Mutate the tier object temporarily to pass lift info
          const liftTierObj = { ...newResult.animeTier, __liftName: liftLabel, __liftTierName: tierLabel, __liftTierColor: liftColor };
          setTierAdvancement(liftTierObj as any);
          setTierAdvSubTier(undefined);
          setIsSubTierAdvance(false);
          setShowTierAdvancement(true);
        }

        currentTierRef.current = {
          key: newKey, subTier: newSubTier, minScore: newMinScore,
          sqTier: newResult.lifts[0]?.tier ?? 'beginner',
          bpTier: newResult.lifts[1]?.tier ?? 'beginner',
          dlTier: newResult.lifts[2]?.tier ?? 'beginner',
        };
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

  const pickFinishPhoto = async () => {
    Alert.alert('Add Photo', 'Choose a source', [
      {
        text: '📷 Take Photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Camera permission needed'); return; }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true, aspect: [4, 3], quality: 0.7,
          });
          if (!result.canceled && result.assets[0]) setFinishPhoto(result.assets[0].uri);
        },
      },
      {
        text: '🖼️ Choose from Library',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert('Photo library permission needed'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [4, 3], quality: 0.7,
          });
          if (!result.canceled && result.assets[0]) setFinishPhoto(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
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

      // Upload photo if selected
      if (finishPhoto && summary?.workoutId && user) {
        try {
          setUploadingPhoto(true);
          const ext = finishPhoto.split('.').pop()?.toLowerCase() ?? 'jpg';
          const fileName = `${user.id}/${summary.workoutId}.${ext}`;
          const base64 = await FileSystem.readAsStringAsync(finishPhoto, { encoding: 'base64' as any });
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const { data: uploadData } = await supabase.storage
            .from('workout-photos').upload(fileName, bytes, { upsert: true, contentType: `image/${ext}` });
          if (uploadData) {
            const { data: urlData } = supabase.storage.from('workout-photos').getPublicUrl(fileName);
            await supabase.from('workout_photos').insert({
              workout_id: summary.workoutId,
              user_id: user.id,
              photo_url: urlData.publicUrl,
            });
          }
        } catch (e) { /* silent */ } finally { setUploadingPhoto(false); }
      }

      setFinishNotes('');
      setFinishPhoto(null);
      setPrMap({});
      setPrevSetsCache({});
      setIsFirstWorkout(false);
      setTutorialStep('done');
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

          {/* Create template from scratch */}
          <TouchableOpacity
            onPress={() => { setBuilderName(''); setBuilderExercises([]); setShowTemplateBuilder(true); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
              borderWidth: 1, borderColor: Colors.border, marginBottom: 20,
            }}
          >
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: Colors.surface2,
              borderWidth: 1, borderColor: Colors.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: Colors.textMuted, fontSize: 22, lineHeight: 26 }}>+</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>Create Template</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 1 }}>
                Build a reusable workout from scratch
              </Text>
            </View>
          </TouchableOpacity>

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

        {/* Template Builder Modal */}
        <Modal visible={showTemplateBuilder} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: 20, paddingVertical: 16,
              borderBottomWidth: 1, borderBottomColor: Colors.border,
            }}>
              <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '900' }}>New Template</Text>
              <TouchableOpacity onPress={() => setShowTemplateBuilder(false)}>
                <Text style={{ color: Colors.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
              {/* Template name */}
              <TextInput
                value={builderName}
                onChangeText={setBuilderName}
                placeholder="Template name (e.g. Push Day, Leg Day...)"
                placeholderTextColor={Colors.textMuted}
                autoFocus
                style={{
                  backgroundColor: Colors.surface, borderRadius: 12,
                  paddingHorizontal: 16, paddingVertical: 14,
                  color: Colors.text, fontSize: 17, fontWeight: '700',
                  borderWidth: 1, borderColor: Colors.border,
                }}
              />

              {/* Added exercises */}
              {builderExercises.length > 0 && (
                <View style={{ gap: 8 }}>
                  {builderExercises.map((ex, i) => (
                    <View key={i} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
                      borderWidth: 1, borderColor: Colors.border,
                    }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{ex.name}</Text>
                        <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>{ex.muscle_group}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setBuilderExercises(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ padding: 6 }}
                      >
                        <Text style={{ color: Colors.danger, fontSize: 16 }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Add exercise button */}
              <TouchableOpacity
                onPress={() => setShowBuilderPicker(true)}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: Colors.surface2, borderRadius: 12, padding: 14,
                  borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
                }}
              >
                <Text style={{ color: Colors.textMuted, fontSize: 20 }}>+</Text>
                <Text style={{ color: Colors.textMuted, fontWeight: '600' }}>Add Exercise</Text>
              </TouchableOpacity>

              {/* Save */}
              <TouchableOpacity
                onPress={async () => {
                  if (!builderName.trim()) { Alert.alert('Add a name'); return; }
                  if (builderExercises.length === 0) { Alert.alert('Add at least one exercise'); return; }
                  await supabase.from('workout_templates').insert({
                    user_id: user!.id,
                    name: builderName.trim(),
                    exercises: builderExercises,
                  });
                  await loadSavedTemplates();
                  setShowTemplateBuilder(false);
                }}
                disabled={!builderName.trim() || builderExercises.length === 0}
                style={{
                  backgroundColor: builderName.trim() && builderExercises.length > 0 ? Colors.accent : Colors.surface2,
                  borderRadius: 14, paddingVertical: 16, alignItems: 'center',
                  marginTop: 8,
                }}
              >
                <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 16 }}>
                  Save Template ({builderExercises.length} exercises)
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>

          {/* Exercise picker for builder */}
          <ExercisePickerModal
            visible={showBuilderPicker}
            alreadyAdded={builderExercises.map(e => e.id)}
            onSelect={(ex) => {
              setBuilderExercises(prev => [...prev, {
                id: ex.id, name: ex.name,
                muscle_group: ex.muscle_group,
                equipment_type: ex.equipment_type,
              }]);
              setShowBuilderPicker(false);
            }}
            onClose={() => setShowBuilderPicker(false)}
          />
        </Modal>

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
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 160 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="interactive"
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

      {/* First workout tutorial tooltips */}
      <FirstWorkoutTooltip
        visible={isFirstWorkout && tutorialStep === 'add_exercise'}
        emoji="💪"
        message="Tap + ADD EXERCISE below to add your first lift"
        position="bottom"
      />
      <FirstWorkoutTooltip
        visible={isFirstWorkout && tutorialStep === 'log_set'}
        emoji="🎯"
        message="Enter weight × reps, then tap LOG to record your set"
        position="bottom"
      />
      <FirstWorkoutTooltip
        visible={isFirstWorkout && tutorialStep === 'finish'}
        emoji="✅"
        message="Nice work! Tap FINISH at the top right to save"
        position="bottom"
      />

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
        subTier={tierAdvSubTier}
        isSubTierAdvance={isSubTierAdvance}
        liftName={(tierAdvancement as any)?.__liftName}
        liftTierName={(tierAdvancement as any)?.__liftTierName}
        liftTierColor={(tierAdvancement as any)?.__liftTierColor}
        onDismiss={() => {
          setShowTierAdvancement(false);
          setTierAdvancement(null);
          setTierAdvSubTier(undefined);
          setIsSubTierAdvance(false);
        }}
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

            {/* Photo picker */}
            <TouchableOpacity
              onPress={pickFinishPhoto}
              style={{
                borderRadius: 12, overflow: 'hidden',
                borderWidth: 1, borderColor: finishPhoto ? Colors.accent + '40' : Colors.border,
                borderStyle: finishPhoto ? 'solid' : 'dashed',
                height: finishPhoto ? 160 : 52,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: Colors.surface2,
              }}
            >
              {finishPhoto ? (
                <Image source={{ uri: finishPhoto }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 18 }}>📷</Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 13, fontWeight: '600' }}>
                    Add a photo to your post
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {finishPhoto && (
              <TouchableOpacity onPress={() => setFinishPhoto(null)} style={{ alignSelf: 'flex-end' }}>
                <Text style={{ color: Colors.danger, fontSize: 12 }}>Remove photo</Text>
              </TouchableOpacity>
            )}

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
