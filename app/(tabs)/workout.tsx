import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useWorkoutStore } from '@/hooks/useWorkout';
import { Colors } from '@/constants/colors';
import { RestTimer } from '@/components/workout/RestTimer';
import { WorkoutCoach } from '@/components/workout/WorkoutCoach';
import { useSubscription } from '@/hooks/useSubscription';
import { WorkoutLiveActivity } from '../../modules/WorkoutLiveActivity';
import { ExerciseCard } from '@/components/workout/ExerciseCard';
import { ElapsedTime, formatElapsed } from '@/components/workout/ElapsedTime';
import { WorkoutIdleScreen } from '@/components/workout/WorkoutIdleScreen';
import { TemplateBuilderSheet } from '@/components/workout/TemplateBuilderSheet';
import { useWorkoutTemplates } from '@/hooks/useWorkoutTemplates';
import { ExercisePickerModal } from '@/components/workout/ExercisePickerModal';
import { TierAdvancementScreen } from '@/components/TierAdvancementScreen';
import { FirstWorkoutTooltip } from '@/components/workout/FirstWorkoutTooltip';
import { getRankResult, RankTier } from '@/constants/ranks';
import { STARTER_PROGRAMS, StarterProgramDay } from '@/constants/starterPrograms';
import { fmtVolume, unitFromProfile } from '@/lib/units';
import { screenText } from '@/lib/contentFilter';
import { useStableCallback } from '@/lib/useStableCallback';
import {
  requestNotificationPermissions,
  setupNotificationChannels,
  notifyWorkoutStarted,
  notifySetLogged,
  clearWorkoutNotifications,
} from '@/lib/workoutNotification';

// PR localId → isPR lookup, built as sets come in
type PRMap = Record<string, boolean>;

// Fire-and-forget: the recap screen should never wait on a photo upload.
// Failures just mean the feed post has no photo — logged, never surfaced.
async function uploadWorkoutPhotoInBackground(uri: string, workoutId: string, userId: string) {
  try {
    const ext = (uri.split('.').pop()?.split('?')[0]?.toLowerCase().replace('jpeg', 'jpg')) ?? 'jpg';
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const fileName = `${userId}/${workoutId}.${ext}`;
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const { error: uploadErr } = await supabase.storage
      .from('workout-photos').upload(fileName, bytes, { upsert: true, contentType });
    if (uploadErr) throw uploadErr;
    const { data: urlData } = supabase.storage.from('workout-photos').getPublicUrl(fileName);
    await supabase.from('workout_photos').insert({
      workout_id: workoutId,
      user_id: userId,
      photo_url: urlData.publicUrl,
    });
  } catch (e: any) {
    console.warn('[workout] background photo upload failed:', e?.message);
  }
}

export default function WorkoutTab() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const unit = unitFromProfile(profile?.unit_pref);
  const { isPro } = useSubscription();
  const [coachLastSet, setCoachLastSet] = useState<{ weight: number; reps: number; rpe?: number; note?: string; exerciseName: string } | null>(null);
  const [coachHistory, setCoachHistory] = useState<{ weight: number; reps: number; rpe?: number; note?: string; exerciseName: string }[]>([]);
  const [coachEnabled, setCoachEnabled] = useState(true);

  useEffect(() => {
    if (!user) return;
    import('@react-native-async-storage/async-storage').then(({ default: AS }) =>
      AS.getItem(`coach_enabled_${user.id}`).then(v => { if (v !== null) setCoachEnabled(v === 'true'); })
    );
  }, [user]);

  const {
    activeWorkout,
    lastSetLoggedAt,
    lastSetWasWarmup,
    newPRs,
    startWorkout,
    addExercise,
    replaceExercise,
    removeExercise,
    logSet,
    updateSet,
    deleteSet,
    finishWorkout,
    discardWorkout,
    clearPRs,
    restoreWorkout,
    syncPending,
    syncFailed,
    toggleSupersetWithNext,
  } = useWorkoutStore();

  // Restore any in-progress workout from Supabase when the app reopens
  const [restoring, setRestoring] = useState(true);
  useEffect(() => {
    if (!user) { setRestoring(false); return; }
    restoreWorkout(user.id).then(restored => {
      if (restored) {
        const name = useWorkoutStore.getState().activeWorkout?.name ?? 'Workout';
        notifyWorkoutStarted(name);
      }
      // Push anything logged offline last session now that we may be back online
      syncPending();
    }).finally(() => setRestoring(false));
  }, [user]);

  // Rest alert target (seconds) — 0 = no alert
  const [restAlertSeconds, setRestAlertSeconds] = useState(120); // default 2 min

  // Request notification permissions on mount
  useEffect(() => {
    setupNotificationChannels();
    requestNotificationPermissions();
  }, []);

  // Local state
  const [showPicker, setShowPicker] = useState(false);
  const [replacingExerciseId, setReplacingExerciseId] = useState<string | null>(null);
  const [showMidWorkoutTemplates, setShowMidWorkoutTemplates] = useState(false);
  const [prMap, setPrMap] = useState<PRMap>({});
  const [finishing, setFinishing] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishNotes, setFinishNotes] = useState('');
  const [finishPhoto, setFinishPhoto] = useState<string | null>(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [prevSetsCache, setPrevSetsCache] = useState<Record<string, any[]>>({});

  // First workout tutorial
  const [isFirstWorkout, setIsFirstWorkout] = useState(false);
  type TutorialStep = 'add_exercise' | 'log_set' | 'finish' | 'done';
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('add_exercise');

  // Tier advancement
  const [tierAdvancement, setTierAdvancement] = useState<RankTier | null>(null);
  const [tierAdvSubTier, setTierAdvSubTier] = useState<number | undefined>(undefined);
  const [isSubTierAdvance, setIsSubTierAdvance] = useState(false);
  const [showTierAdvancement, setShowTierAdvancement] = useState(false);
  // Track { key, subTier, minScore } so we can detect advancement vs regression
  const currentTierRef = useRef<{
    key: string; subTier: number; minScore: number;
    sqTier?: string; bpTier?: string; dlTier?: string;
  } | null>(null);

  // Smart suggestion + templates — SWR-cached hook; no reload flash on every
  // return to the idle tab.
  const {
    daySuggestion, templates, savedTemplates, lastWorkoutExercises,
    loadingTemplates, refetch: refetchTemplates, setDaySuggestion,
  } = useWorkoutTemplates(!activeWorkout);

  // Duration ticking lives inside <ElapsedTime /> so the per-second interval
  // re-renders one leaf <Text>, not this whole screen.

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
    await refetchTemplates();
  };

  const deleteTemplate = async (templateId: string) => {
    await supabase.from('workout_templates').delete().eq('id', templateId);
    refetchTemplates();
  };

  const startFromSavedTemplate = async (tmpl: any) => {
    if (!user) return;
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const wName = `${day} · ${tmpl.name}`;
    try {
      await seedCurrentTier();
      await startWorkout(wName, user.id);
      (tmpl.exercises as any[]).forEach(ex => addExercise({
        id: ex.id, name: ex.name,
        muscle_group: ex.muscle_group,
        equipment_type: ex.equipment_type,
      }));
      await supabase.from('workout_templates')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', tmpl.id);
      notifyWorkoutStarted(wName);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // Start a starter-program day: resolve exercise names to library ids, then
  // reuse the template start path so the whole flow behaves identically.
  const startStarterDay = async (day: StarterProgramDay) => {
    const { data } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, equipment_type')
      .in('name', day.exerciseNames)
      .eq('is_custom', false);
    const byName = new Map((data ?? []).map((e: any) => [e.name.toLowerCase(), e]));
    const resolved = day.exerciseNames
      .map(n => byName.get(n.toLowerCase()))
      .filter(Boolean) as { id: string; name: string; muscle_group: string; equipment_type?: string }[];
    if (resolved.length === 0) {
      Alert.alert('Error', 'Could not load the program exercises. Check your connection and try again.');
      return;
    }
    await startFromTemplate(day.name, resolved);
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
    const result = getRankResult(prs, profile?.bodyweight_lbs ?? 185);
    currentTierRef.current = {
      key: result.tier.key,
      subTier: result.subTier,
      minScore: result.tier.minScore,
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
      notifyWorkoutStarted(wName);
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
      notifyWorkoutStarted(workoutName.trim());
      WorkoutLiveActivity.startActivity(workoutName.trim(), {
        exerciseName: '', setNumber: 0, weight: 0, reps: 0, totalSets: 0,
      });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not start workout');
    }
  };

  // ─── ADD EXERCISE ─────────────────────────────────────────────────────────
  const handlePickExercise = async (exercise: { id: string; name: string; muscle_group: string; equipment_type?: string }) => {
    if (replacingExerciseId) {
      await replaceExercise(replacingExerciseId, exercise);
      setReplacingExerciseId(null);
    } else {
      addExercise(exercise);
    }
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

  const handleReplaceExercise = (exerciseId: string) => {
    setReplacingExerciseId(exerciseId);
    setShowPicker(true);
  };

  const handleAddTemplateExercises = (tmpl: any) => {
    (tmpl.exercises as any[]).forEach(ex => {
      if (!useWorkoutStore.getState().activeWorkout?.exercises.find(e => e.exerciseId === ex.id)) {
        addExercise({ id: ex.id, name: ex.name, muscle_group: ex.muscle_group, equipment_type: ex.equipment_type });
      }
    });
    setShowMidWorkoutTemplates(false);
  };

  // ─── LOG SET ──────────────────────────────────────────────────────────────
  // Stable identity (useStableCallback below) so memo'd ExerciseCards don't
  // re-render when this screen does.
  const handleLogSet = async (
    exerciseId: string,
    data: { weight: number; reps: number; rpe?: number; note?: string }
  ) => {
    if (!activeWorkout || !user) return { isPR: false };
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
      // Feed coach
      const coachSet = { weight: data.weight, reps: data.reps, rpe: data.rpe, note: data.note, exerciseName: ex.exerciseName };
      const history = ex.sets.slice(0, -1).map(s => ({ weight: s.weight, reps: s.reps, rpe: s.rpe, note: s.note, exerciseName: ex.exerciseName }));
      setCoachHistory(history);
      setCoachLastSet(coachSet);
    }

    // Check for tier/sub-tier advancement on SBD PRs
    if (result.isPR) {
      const SBD_NAMES = ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts'];
      const exName = ex?.exerciseName ?? '';
      if (SBD_NAMES.some(n => exName.toLowerCase() === n.toLowerCase())) {
        // Fetch ALL PRs (filter to SBD inside getRankResult)
        const { data: allPrs } = await supabase
          .from('personal_records')
          .select('weight, reps, exercises!inner(name)')
          .eq('user_id', user.id);

        const prs = (allPrs ?? []).map((p: any) => ({
          exerciseName: p.exercises?.name ?? '',
          weight: p.weight, reps: p.reps,
        }));
        const newResult = getRankResult(prs, profile?.bodyweight_lbs ?? 185);
        const newKey = newResult.tier.key;
        const newMinScore = newResult.tier.minScore;
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
          setTierAdvancement(newResult.tier);
          setTierAdvSubTier(newSubTier);
          setIsSubTierAdvance(false);
          setShowTierAdvancement(true);
        } else if (newMinScore > prev.minScore) {
          // Full overall rank advance
          setTierAdvancement(newResult.tier);
          setTierAdvSubTier(undefined);
          setIsSubTierAdvance(false);
          setShowTierAdvancement(true);
        } else if (newKey === prev.key && newSubTier > prev.subTier) {
          // Sub-tier advance within same rank
          setTierAdvancement(newResult.tier);
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
          const liftTierObj = { ...newResult.tier, __liftName: liftLabel, __liftTierName: tierLabel, __liftTierColor: liftColor };
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

    // Lock screen notification + Live Activity update
    const exName = ex?.exerciseName ?? '';
    const setNum = ex?.sets.length ?? 1;
    notifySetLogged(exName, setNum, restAlertSeconds);
    WorkoutLiveActivity.updateActivity({
      exerciseName: exName,
      setNumber: setNum,
      weight: data.weight,
      reps: data.reps,
      totalSets: ex?.sets.length ?? 0,
      restSeconds: restAlertSeconds,
    });

    return result;
  };

  // Identity-stable wrappers for props of memo'd ExerciseCards. Store actions
  // (removeExercise/deleteSet/updateSet/toggleSupersetWithNext) are already
  // stable zustand references; these cover the screen-level handlers.
  const stableLogSet = useStableCallback(handleLogSet);
  const stableReplaceExercise = useStableCallback(handleReplaceExercise);
  const navigateToExerciseDetail = useStableCallback((id: string) => router.push(`/exercise/${id}`));

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

  const handleFinishConfirm = async (quick = false) => {
    // Screen the shared workout note for objectionable content (Guideline 1.2)
    if (!quick) {
      const noteIssue = screenText(finishNotes, 'workout note');
      if (noteIssue) { Alert.alert('Not allowed', noteIssue); return; }
    }
    setFinishing(true);
    setShowFinishModal(false);
    try {
      if (saveAsTemplate && activeWorkout && templateName.trim()) {
        await saveTemplate(templateName.trim(), activeWorkout.exercises);
      }
      setSaveAsTemplate(false);
      setTemplateName('');

      const summary = await finishWorkout(quick ? undefined : (finishNotes.trim() || undefined));

      // Recap first, everything else after — the transition should feel instant.
      setPrMap({});
      setPrevSetsCache({});
      setIsFirstWorkout(false);
      setTutorialStep('done');
      clearWorkoutNotifications();
      WorkoutLiveActivity.endActivity();
      router.push({ pathname: '/workout/summary', params: { data: JSON.stringify(summary) } });

      // Photo uploads quietly in the background while the recap is on screen
      if (!quick && finishPhoto && summary?.workoutId && user) {
        uploadWorkoutPhotoInBackground(finishPhoto, summary.workoutId, user.id);
      }
      setFinishNotes('');
      setFinishPhoto(null);
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
            clearWorkoutNotifications();
            WorkoutLiveActivity.endActivity();
            setPrMap({});
            setPrevSetsCache({});
          },
        },
      ]
    );
  };

  // ─── NO ACTIVE WORKOUT ────────────────────────────────────────────────────
  // Starter programs are pitched at new lifters (no experience set reads as new)
  const isNewLifter = !profile?.experience_level || profile.experience_level === 'beginner';

  if (restoring) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  if (!activeWorkout) {
    return (
      <View style={{ flex: 1 }}>
        <WorkoutIdleScreen
          isNewLifter={isNewLifter}
          daySuggestion={daySuggestion}
          templates={templates}
          savedTemplates={savedTemplates}
          loadingTemplates={loadingTemplates}
          onStartBlank={handleStartPress}
          onStartFromTemplate={startFromTemplate}
          onStartFromSavedTemplate={startFromSavedTemplate}
          onStartStarterDay={startStarterDay}
          onDeleteTemplate={deleteTemplate}
          onPinSuggestion={() => {
            if (!daySuggestion) return;
            const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
            Alert.alert(
              `Pin as ${dayName} template?`,
              `Every ${dayName}, this workout will be your default suggestion.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: `Pin for ${dayName}`,
                  onPress: async () => {
                    if (!user) return;
                    await supabase.from('workout_templates').insert({
                      user_id: user.id,
                      name: daySuggestion.name,
                      exercises: daySuggestion.exercises as any,
                      day_of_week: new Date().getDay(),
                    });
                    setDaySuggestion(prev => prev ? { ...prev, isPinned: true, dayLabel: `📌 Your ${dayName} plan` } : null);
                  },
                },
              ]
            );
          }}
          onUnpinSuggestion={() => {
            if (!daySuggestion?.pinnedTemplateId) return;
            Alert.alert('Unpin?', 'Remove this as your pinned template for this day?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Unpin', style: 'destructive', onPress: async () => {
                await supabase.from('workout_templates').update({ day_of_week: null }).eq('id', daySuggestion.pinnedTemplateId!);
                setDaySuggestion(() => null);
              }},
            ]);
          }}
          onCreateTemplate={() => setShowTemplateBuilder(true)}
        />

        {/* Template builder */}
        <TemplateBuilderSheet
          visible={showTemplateBuilder}
          onClose={() => setShowTemplateBuilder(false)}
          onSaved={refetchTemplates}
        />

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
      </View>
    );
  }

  // ─── ACTIVE WORKOUT ───────────────────────────────────────────────────────
  const totalSets = activeWorkout.exercises.reduce((n, e) => n + e.sets.length, 0);
  const totalVolume = activeWorkout.exercises
    .flatMap(e => e.sets)
    .reduce((n, s) => n + s.weight * s.reps, 0);
  // Sets without a DB id are queued on-device (logged offline)
  const pendingSyncCount = activeWorkout.exercises
    .flatMap(e => e.sets)
    .filter(s => !s.id).length;
  // Progressive disclosure: supersets are an intermediate+ tool. Day-one
  // lifters get a clean card — no chain icons to decode.
  const showSupersetControls = !!profile?.experience_level && profile.experience_level !== 'beginner';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      {/* Sticky header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.bg,
        gap: 10,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{
            color: Colors.text,
            fontSize: 17,
            fontWeight: '800',
            letterSpacing: -0.4,
          }} numberOfLines={1}>
            {activeWorkout.name}
          </Text>
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 4, alignItems: 'center' }}>
            <ElapsedTime
              startedAt={activeWorkout.startedAt}
              style={{
                color: Colors.accent,
                fontSize: 13,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
                letterSpacing: 0.5,
              }}
            />
            <View style={{ width: 1, height: 10, backgroundColor: Colors.border }} />
            <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
              {totalSets} set{totalSets !== 1 ? 's' : ''}
            </Text>
            {totalVolume > 0 && (
              <>
                <View style={{ width: 1, height: 10, backgroundColor: Colors.border }} />
                <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                  {fmtVolume(totalVolume, unit)}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Templates — peek at saved templates without leaving the workout */}
        <TouchableOpacity
          onPress={() => setShowMidWorkoutTemplates(true)}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: Colors.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 14 }}>📋</Text>
        </TouchableOpacity>

        {/* Discard */}
        <TouchableOpacity
          onPress={handleDiscard}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: Colors.surface2,
          }}
        >
          <Text style={{ color: Colors.textMuted, fontSize: 12, fontWeight: '700' }}>Discard</Text>
        </TouchableOpacity>

        {/* Finish */}
        <TouchableOpacity
          onPress={handleFinishPress}
          disabled={finishing}
          style={{
            paddingHorizontal: 18,
            paddingVertical: 9,
            borderRadius: 10,
            backgroundColor: Colors.accent,
            shadowColor: Colors.accent,
            shadowOpacity: 0.35,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 5,
          }}
        >
          {finishing ? (
            <ActivityIndicator color={Colors.text} size="small" />
          ) : (
            <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>FINISH</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Offline queue banner — only after a sync attempt actually failed,
          never during the normal in-flight moment of an online log */}
      {syncFailed && pendingSyncCount > 0 && (
        <TouchableOpacity
          onPress={() => syncPending()}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: Colors.goldDim, paddingVertical: 8, paddingHorizontal: 16,
            borderBottomWidth: 1, borderBottomColor: Colors.gold + '30',
          }}
        >
          <Text style={{ color: Colors.gold, fontSize: 12, fontWeight: '700' }}>
            Offline — {pendingSyncCount === 1 ? '1 set' : `${pendingSyncCount} sets`} saved on this phone
          </Text>
          <Text style={{ color: Colors.textMuted, fontSize: 11 }}>Tap to retry sync</Text>
        </TouchableOpacity>
      )}

      {/* Rest timer — appears after first set */}
      <RestTimer lastSetLoggedAt={lastSetLoggedAt} lastSetWasWarmup={lastSetWasWarmup} />
      <WorkoutCoach
        lastSet={coachLastSet}
        allSetsThisExercise={coachHistory}
        isPro={isPro}
        enabled={coachEnabled}
        trainingStyle={profile?.training_style}
        rankTierKey={(profile as any)?.rank_tier_key}
        onDismiss={() => setCoachLastSet(null)}
      />

      {/* PR Flash Banner */}
      {newPRs.length > 0 && (
        <View style={{
          backgroundColor: Colors.gold + '14',
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: Colors.gold + '30',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          shadowColor: Colors.gold,
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }}>
          <View style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: Colors.gold + '20',
            borderWidth: 1,
            borderColor: Colors.gold + '50',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 20 }}>🏆</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{
              color: Colors.gold,
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}>
              Personal Record
            </Text>
            <Text style={{
              color: Colors.gold,
              fontSize: 13,
              fontWeight: '700',
              marginTop: 2,
              opacity: 0.9,
            }}>
              {newPRs.map(p => `${p.exerciseName}  ${p.weight} × ${p.reps}`).join('  ·  ')}
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

        {activeWorkout.exercises.map((exercise, exIdx) => {
          const next = activeWorkout.exercises[exIdx + 1];
          const prev = activeWorkout.exercises[exIdx - 1];
          const pairedWithNext = !!exercise.supersetId && exercise.supersetId === next?.supersetId;
          const pairedWithPrev = !!exercise.supersetId && exercise.supersetId === prev?.supersetId;
          return (
            <ExerciseCard
              key={exercise.exerciseId}
              exercise={exercise}
              prevSets={prevSetsCache[exercise.exerciseId] ?? []}
              prMap={prMap}
              workoutId={activeWorkout.id!}
              userId={user!.id}
              onLogSet={stableLogSet}
              onRemove={removeExercise}
              onReplace={stableReplaceExercise}
              onDeleteSet={deleteSet}
              onEditSet={updateSet}
              onNavigateToDetail={navigateToExerciseDetail}
              supersetRole={pairedWithNext ? 'first' : pairedWithPrev ? 'second' : null}
              canToggleSuperset={showSupersetControls && (pairedWithNext || (!exercise.supersetId && !!next && !next.supersetId))}
              onToggleSuperset={toggleSupersetWithNext}
            />
          );
        })}
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
        onClose={() => { setShowPicker(false); setReplacingExerciseId(null); }}
      />

      {/* Templates — viewable mid-workout without leaving the session */}
      <Modal visible={showMidWorkoutTemplates} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 20, paddingVertical: 16,
            borderBottomWidth: 1, borderBottomColor: Colors.border,
          }}>
            <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800' }}>Your Templates</Text>
            <TouchableOpacity onPress={() => setShowMidWorkoutTemplates(false)}>
              <Text style={{ color: Colors.accent, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
            {savedTemplates.length === 0 && (
              <Text style={{ color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 40 }}>
                No saved templates yet.
              </Text>
            )}
            {savedTemplates.map(tmpl => (
              <View
                key={tmpl.id}
                style={{
                  backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
                  borderWidth: 1, borderColor: Colors.border, marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
                    {tmpl.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleAddTemplateExercises(tmpl)}
                    style={{
                      backgroundColor: Colors.accentDim, borderRadius: 8,
                      paddingHorizontal: 10, paddingVertical: 6,
                      borderWidth: 1, borderColor: Colors.accent + '40',
                    }}
                  >
                    <Text style={{ color: Colors.accent, fontWeight: '800', fontSize: 12 }}>+ Add exercises</Text>
                  </TouchableOpacity>
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
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Finish Modal — social post style */}
      <Modal visible={showFinishModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {/* Header */}
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: 20, paddingVertical: 16,
              borderBottomWidth: 1, borderBottomColor: Colors.border,
            }}>
              <TouchableOpacity onPress={() => setShowFinishModal(false)}>
                <Text style={{ color: Colors.textMuted, fontWeight: '600', fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800' }}>Finish Workout</Text>
              <TouchableOpacity onPress={() => handleFinishConfirm(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: Colors.textMuted, fontWeight: '600', fontSize: 13 }}>Quick Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
              {/* Workout name */}
              <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.8 }}>
                {activeWorkout?.name}
              </Text>

              {/* Stats row */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  { label: 'Duration', value: activeWorkout ? formatElapsed(Math.max(0, Math.floor((Date.now() - new Date(activeWorkout.startedAt as any).getTime()) / 1000))) : '0:00' },
                  { label: 'Sets', value: String(totalSets) },
                  { label: 'Volume', value: fmtVolume(totalVolume, unit) },
                ].map((s, i) => (
                  <View key={i} style={{
                    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
                    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
                  }}>
                    <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</Text>
                    <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '800' }}>{s.value}</Text>
                  </View>
                ))}
              </View>

              {/* PR callout */}
              {newPRs.length > 0 && (
                <View style={{
                  backgroundColor: Colors.gold + '15', borderRadius: 14, padding: 16,
                  borderWidth: 1, borderColor: Colors.gold + '40',
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                }}>
                  <Text style={{ fontSize: 26 }}>🏆</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.gold, fontWeight: '800', fontSize: 14 }}>
                      {newPRs.length === 1 ? 'New Personal Record!' : `${newPRs.length} New PRs!`}
                    </Text>
                    <Text style={{ color: Colors.gold, fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                      {newPRs.map(p => p.exerciseName).join(', ')}
                    </Text>
                  </View>
                </View>
              )}

              {/* Photo — large and prominent */}
              <TouchableOpacity
                onPress={pickFinishPhoto}
                activeOpacity={0.85}
                style={{
                  borderRadius: 16, overflow: 'hidden',
                  borderWidth: 1.5,
                  borderColor: finishPhoto ? Colors.accent + '50' : Colors.border,
                  borderStyle: finishPhoto ? 'solid' : 'dashed',
                  height: finishPhoto ? 260 : 110,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: Colors.surface2,
                }}
              >
                {finishPhoto ? (
                  <Image source={{ uri: finishPhoto }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 28 }}>📸</Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 14, fontWeight: '700' }}>Add a photo</Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 11 }}>Show your crew what you're working with</Text>
                  </View>
                )}
              </TouchableOpacity>
              {finishPhoto && (
                <TouchableOpacity onPress={() => setFinishPhoto(null)} style={{ alignSelf: 'flex-end', marginTop: -6 }}>
                  <Text style={{ color: Colors.danger, fontSize: 12 }}>Remove photo</Text>
                </TouchableOpacity>
              )}

              {/* Caption */}
              <TextInput
                value={finishNotes}
                onChangeText={setFinishNotes}
                placeholder="Add a caption... (optional)"
                placeholderTextColor={Colors.textMuted}
                multiline
                style={{
                  backgroundColor: Colors.surface, borderRadius: 14,
                  paddingHorizontal: 16, paddingVertical: 14,
                  color: Colors.text, fontSize: 15, lineHeight: 22,
                  minHeight: 80, maxHeight: 140, textAlignVertical: 'top',
                  borderWidth: 1, borderColor: Colors.border,
                }}
              />

              {/* Save as template */}
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
                  {saveAsTemplate && <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800' }}>✓</Text>}
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

              {/* Post button */}
              <TouchableOpacity
                onPress={() => handleFinishConfirm(false)}
                disabled={finishing}
                style={{
                  backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 18,
                  alignItems: 'center', marginTop: 4,
                  shadowColor: Colors.accent, shadowOpacity: 0.4, shadowRadius: 16,
                  shadowOffset: { width: 0, height: 6 }, elevation: 8,
                }}
              >
                {finishing
                  ? <ActivityIndicator color={Colors.text} />
                  : <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 17, letterSpacing: 0.3 }}>
                      Post Workout →
                    </Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
