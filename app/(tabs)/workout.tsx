import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useWorkoutStore } from '@/hooks/useWorkout';
import { useWorkoutTemplates } from '@/hooks/useWorkoutTemplates';
import { Colors, Spacing } from '@/constants/theme';
import { Button, EmptyState } from '@/components/ui';
import { fireImpact } from '@/components/anime';
import { useWorld } from '@/theme';
import { WorkoutLiveActivity } from '../../modules/WorkoutLiveActivity';
import { ExerciseCard } from '@/components/workout/ExerciseCard';
import { formatElapsed } from '@/components/workout/ElapsedTime';
import { RestTimer } from '@/components/workout/RestTimer';
import { WorkoutIdleScreen } from '@/components/workout/WorkoutIdleScreen';
import { TemplateBuilderSheet } from '@/components/workout/TemplateBuilderSheet';
import { ExercisePickerModal } from '@/components/workout/ExercisePickerModal';
import { FirstWorkoutTooltip } from '@/components/workout/FirstWorkoutTooltip';
import { WorkoutHeader } from '@/components/workout/WorkoutHeader';
import { OfflineBanner } from '@/components/workout/OfflineBanner';
import { NameWorkoutSheet } from '@/components/workout/NameWorkoutSheet';
import { TemplatesSheet } from '@/components/workout/TemplatesSheet';
import { FinishSheet, type FinishDraft } from '@/components/workout/FinishSheet';
import { useWorkoutSession, uploadWorkoutPhotoInBackground } from '@/components/workout/useWorkoutSession';
import { useIdleActions } from '@/components/workout/useIdleActions';
import { unitFromProfile } from '@/lib/units';
import { screenText } from '@/lib/contentFilter';
import { useStableCallback } from '@/lib/useStableCallback';
import {
  requestNotificationPermissions, setupNotificationChannels, notifyWorkoutStarted,
  notifySetLogged, clearWorkoutNotifications,
} from '@/lib/workoutNotification';

type Ex = { id: string; name: string; muscle_group: string; equipment_type?: string };
type TutorialStep = 'add_exercise' | 'log_set' | 'finish' | 'done';
const EMPTY_DRAFT: FinishDraft = { notes: '', photo: null, saveAsTemplate: false, templateName: '' };
const REST_ALERT_SECONDS = 120;
const dayName = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });

export default function WorkoutTab() {
  const router = useRouter();
  const world = useWorld();
  const { user, profile } = useAuth();
  const unit = unitFromProfile(profile?.unit_pref);
  const {
    activeWorkout, lastSetLoggedAt, lastSetWasWarmup, newPRs,
    startWorkout, addExercise, replaceExercise, removeExercise, logSet, updateSet, deleteSet,
    finishWorkout, discardWorkout, restoreWorkout, syncPending, syncFailed, toggleSupersetWithNext,
  } = useWorkoutStore();

  const session = useWorkoutSession({
    userId: user?.id, bodyweightLbs: profile?.bodyweight_lbs, gender: profile?.gender, unit,
    firstName: profile?.display_name?.split(' ')[0] ?? 'lifter',
  });

  // Restore any in-progress workout from Supabase when the app reopens
  const [restoring, setRestoring] = useState(true);
  useEffect(() => {
    if (!user) { setRestoring(false); return; }
    restoreWorkout(user.id).then(restored => {
      if (restored) {
        notifyWorkoutStarted(useWorkoutStore.getState().activeWorkout?.name ?? 'Workout');
        session.seed();
      }
      syncPending(); // push anything logged offline last session
    }).finally(() => setRestoring(false));
  }, [user]);

  useEffect(() => { setupNotificationChannels(); requestNotificationPermissions(); }, []);

  const [showPicker, setShowPicker] = useState(false);
  const [replacingExerciseId, setReplacingExerciseId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [prMap, setPrMap] = useState<Record<string, boolean>>({});
  const [finishing, setFinishing] = useState(false);
  const [nameSheet, setNameSheet] = useState<'start' | 'rename' | null>(null);
  const [workoutName, setWorkoutName] = useState('');
  const [showFinish, setShowFinish] = useState(false);
  const [draft, setDraft] = useState<FinishDraft>(EMPTY_DRAFT);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [prevSetsCache, setPrevSetsCache] = useState<Record<string, any[]>>({});
  const [isFirstWorkout, setIsFirstWorkout] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('add_exercise');

  const {
    daySuggestion, templates, savedTemplates,
    loadingTemplates, refetch: refetchTemplates, setDaySuggestion,
  } = useWorkoutTemplates(!activeWorkout);

  const promptStart = () => { setWorkoutName(`${dayName()} workout`); setNameSheet('start'); };

  // Auto-start first workout when coming from the First Steps task
  useFocusEffect(useCallback(() => {
    if ((global as any).__startFirstWorkout && !activeWorkout && user) {
      (global as any).__startFirstWorkout = false;
      promptStart();
    }
  }, [activeWorkout, user]));

  const startWith = async (name: string, exercises: Ex[], liveActivity = false) => {
    if (!user) return;
    try {
      await session.seed();
      await startWorkout(name, user.id);
      exercises.forEach(ex => addExercise(ex));
      notifyWorkoutStarted(name);
      if (liveActivity) {
        WorkoutLiveActivity.startActivity(name, { exerciseName: '', setNumber: 0, weight: 0, reps: 0, totalSets: 0 });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not start workout');
    }
  };

  const idle = useIdleActions({
    userId: user?.id, daySuggestion, setDaySuggestion, refetchTemplates,
    startWith: (name, exercises) => startWith(name, exercises),
  });

  const confirmName = async () => {
    const name = workoutName.trim();
    if (!name) return;
    if (nameSheet === 'rename' && activeWorkout) {
      // Rename without touching useWorkout internals: patch the store and the
      // row (a still-queued offline create picks the new name up on sync).
      useWorkoutStore.setState(s => (s.activeWorkout ? { activeWorkout: { ...s.activeWorkout, name } } : {}));
      if (activeWorkout.id) supabase.from('workouts').update({ name }).eq('id', activeWorkout.id).then(() => {});
      setNameSheet(null);
      return;
    }
    setNameSheet(null);
    if (user) {
      const { count } = await supabase.from('workouts').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).not('ended_at', 'is', null);
      if ((count ?? 0) === 0) { setIsFirstWorkout(true); setTutorialStep('add_exercise'); }
    }
    await startWith(name, [], true);
  };

  // ─── Exercises ─────────────────────────────────────────────────────────────
  const handlePickExercise = async (exercise: Ex) => {
    if (replacingExerciseId) {
      await replaceExercise(replacingExerciseId, exercise);
      setReplacingExerciseId(null);
    } else {
      addExercise(exercise);
    }
    if (isFirstWorkout && tutorialStep === 'add_exercise') setTutorialStep('log_set');
    // Previous session's sets for this exercise — must be scoped to this user
    // (RLS also exposes friends' sets). Keep only the latest session, in set
    // order, since ExerciseCard indexes prevSets by sets-logged-so-far.
    if (user && !prevSetsCache[exercise.id]) {
      const { data } = await supabase
        .from('workout_sets')
        .select('workout_id, set_number, weight, reps, rpe, note, workouts!inner(user_id)')
        .eq('exercise_id', exercise.id)
        .eq('workouts.user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(20);
      if (data && data.length > 0) {
        const lastId = data[0].workout_id;
        const last = data.filter(s => s.workout_id === lastId).sort((a, b) => a.set_number - b.set_number)
          .map(({ set_number, weight, reps, rpe, note }) => ({ set_number, weight, reps, rpe, note }));
        setPrevSetsCache(prev => ({ ...prev, [exercise.id]: last }));
      }
    }
  };

  const handleAddTemplateExercises = (tmpl: any) => {
    (tmpl.exercises as any[]).forEach(ex => {
      if (!useWorkoutStore.getState().activeWorkout?.exercises.find(e => e.exerciseId === ex.id)) {
        addExercise({ id: ex.id, name: ex.name, muscle_group: ex.muscle_group, equipment_type: ex.equipment_type });
      }
    });
    setShowTemplates(false);
  };

  // ─── Log set ───────────────────────────────────────────────────────────────
  const handleLogSet = async (exerciseId: string, data: { weight: number; reps: number; rpe?: number; note?: string }) => {
    if (!activeWorkout || !user) return { isPR: false };
    const result = await logSet(exerciseId, data, activeWorkout.id, user.id);
    if (isFirstWorkout && tutorialStep === 'log_set') setTutorialStep('finish');

    const ex = useWorkoutStore.getState().activeWorkout?.exercises.find(e => e.exerciseId === exerciseId);
    if (ex && ex.sets.length > 0) {
      setPrMap(prev => ({ ...prev, [ex.sets[ex.sets.length - 1].localId]: result.isPR }));
      // PR: the anime "hit" — impact frame with ドン — then (first PR only) a cameo.
      if (result.isPR) fireImpact(world.aura, world.sfx.pr);
      session.onSetLogged({ exerciseName: ex.exerciseName, weight: data.weight, reps: data.reps, isPR: result.isPR }, REST_ALERT_SECONDS);
    }

    const exName = ex?.exerciseName ?? '';
    const setNum = ex?.sets.length ?? 1;
    notifySetLogged(exName, setNum, REST_ALERT_SECONDS);
    WorkoutLiveActivity.updateActivity({
      exerciseName: exName, setNumber: setNum, weight: data.weight, reps: data.reps,
      totalSets: ex?.sets.length ?? 0, restSeconds: REST_ALERT_SECONDS,
    });
    return result;
  };

  // Identity-stable wrappers for memo'd ExerciseCards (store actions are already stable)
  const stableLogSet = useStableCallback(handleLogSet);
  const stableReplace = useStableCallback((id: string) => { setReplacingExerciseId(id); setShowPicker(true); });
  const stableDetail = useStableCallback((id: string) => router.push(`/exercise/${id}`));

  // ─── Finish / discard ─────────────────────────────────────────────────────
  const openFinish = () => {
    if (!activeWorkout) return;
    if (activeWorkout.exercises.every(e => e.sets.length === 0)) {
      Alert.alert('No sets logged', 'Log at least one set before finishing.');
      return;
    }
    setShowFinish(true);
  };

  const finish = async (quick: boolean) => {
    if (!quick) {
      const issue = screenText(draft.notes, 'workout note'); // Guideline 1.2
      if (issue) { Alert.alert('Not allowed', issue); return; }
    }
    setFinishing(true);
    setShowFinish(false);
    try {
      if (draft.saveAsTemplate && activeWorkout && draft.templateName.trim()) {
        await idle.saveTemplate(draft.templateName.trim(), activeWorkout.exercises);
      }
      const { sets, facts } = session.captureSession(activeWorkout);
      const summary = await finishWorkout(quick ? undefined : (draft.notes.trim() || undefined));
      const power = session.finishPower(sets);

      setPrMap({});
      setPrevSetsCache({});
      setIsFirstWorkout(false);
      setTutorialStep('done');
      clearWorkoutNotifications();
      WorkoutLiveActivity.endActivity();
      router.push({ pathname: '/workout/summary', params: { data: JSON.stringify({ ...summary, power, cameo: facts }) } });

      if (!quick && draft.photo && summary?.workoutId && user) {
        uploadWorkoutPhotoInBackground(draft.photo, summary.workoutId, user.id);
      }
      setDraft(EMPTY_DRAFT);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not finish workout');
    } finally {
      setFinishing(false);
    }
  };

  const discard = () => Alert.alert('Discard workout', 'This deletes the workout and every logged set.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Discard', style: 'destructive', onPress: async () => {
        await discardWorkout();
        clearWorkoutNotifications();
        WorkoutLiveActivity.endActivity();
        setPrMap({});
        setPrevSetsCache({});
      },
    },
  ]);

  // ─── Render ───────────────────────────────────────────────────────────────
  if (restoring) {
    return <SafeAreaView style={styles.loading}><ActivityIndicator color={world.aura} /></SafeAreaView>;
  }

  const nameSheetEl = (
    <NameWorkoutSheet
      visible={nameSheet != null}
      title={nameSheet === 'rename' ? 'Rename workout' : 'Name this workout'}
      confirmLabel={nameSheet === 'rename' ? 'Save name' : 'Start workout'}
      name={workoutName}
      onChange={setWorkoutName}
      onConfirm={confirmName}
      onClose={() => setNameSheet(null)}
    />
  );

  if (!activeWorkout) {
    // Starter programs are pitched at new lifters (no experience set reads as new)
    const isNewLifter = !profile?.experience_level || profile.experience_level === 'beginner';
    return (
      <View style={styles.flex}>
        <WorkoutIdleScreen
          isNewLifter={isNewLifter}
          daySuggestion={daySuggestion}
          templates={templates}
          savedTemplates={savedTemplates}
          loadingTemplates={loadingTemplates}
          onStartBlank={promptStart}
          onStartFromTemplate={idle.startFromTemplate}
          onStartFromSavedTemplate={idle.startFromSavedTemplate}
          onStartStarterDay={idle.startStarterDay}
          onDeleteTemplate={idle.deleteTemplate}
          onPinSuggestion={idle.pinSuggestion}
          onUnpinSuggestion={idle.unpinSuggestion}
          onCreateTemplate={() => setShowTemplateBuilder(true)}
        />
        <TemplateBuilderSheet visible={showTemplateBuilder} onClose={() => setShowTemplateBuilder(false)} onSaved={refetchTemplates} />
        {nameSheetEl}
      </View>
    );
  }

  const allSets = activeWorkout.exercises.flatMap(e => e.sets);
  const totalVolume = allSets.reduce((n, s) => n + s.weight * s.reps, 0);
  const pendingSyncCount = allSets.filter(s => !s.id).length; // queued on-device
  // Supersets are an intermediate+ tool; day-one lifters get a clean card.
  const showSupersetControls = !!profile?.experience_level && profile.experience_level !== 'beginner';
  const elapsed = formatElapsed(Math.max(0, Math.floor((Date.now() - new Date(activeWorkout.startedAt as any).getTime()) / 1000)));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <WorkoutHeader
        name={activeWorkout.name}
        startedAt={activeWorkout.startedAt}
        finishing={finishing}
        onRename={() => { setWorkoutName(activeWorkout.name); setNameSheet('rename'); }}
        onFinish={openFinish}
        onShowTemplates={() => setShowTemplates(true)}
        onDiscard={discard}
      />
      {syncFailed && pendingSyncCount > 0 && <OfflineBanner count={pendingSyncCount} onRetry={() => syncPending()} />}

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
      >
        {activeWorkout.exercises.length === 0 && (
          <EmptyState icon="lift" title="No exercises yet" body="Add your first lift." />
        )}
        {activeWorkout.exercises.map((exercise, i) => {
          const next = activeWorkout.exercises[i + 1];
          const prev = activeWorkout.exercises[i - 1];
          const pairedWithNext = !!exercise.supersetId && exercise.supersetId === next?.supersetId;
          const pairedWithPrev = !!exercise.supersetId && exercise.supersetId === prev?.supersetId;
          return (
            <ExerciseCard
              key={exercise.exerciseId}
              exercise={exercise}
              prevSets={prevSetsCache[exercise.exerciseId]}
              prMap={prMap}
              workoutId={activeWorkout.id!}
              userId={user!.id}
              onLogSet={stableLogSet}
              onRemove={removeExercise}
              onReplace={stableReplace}
              onDeleteSet={deleteSet}
              onEditSet={updateSet}
              onNavigateToDetail={stableDetail}
              supersetRole={pairedWithNext ? 'first' : pairedWithPrev ? 'second' : null}
              canToggleSuperset={showSupersetControls && (pairedWithNext || (!exercise.supersetId && !!next && !next.supersetId))}
              onToggleSuperset={toggleSupersetWithNext}
            />
          );
        })}
        <View style={styles.add}>
          <Button label="Add exercise" icon="add" variant="tinted" size="lg" fullWidth onPress={() => setShowPicker(true)} />
        </View>
      </ScrollView>

      <FirstWorkoutTooltip visible={isFirstWorkout && tutorialStep === 'add_exercise'} message="Tap Add exercise to add your first lift." />
      <FirstWorkoutTooltip visible={isFirstWorkout && tutorialStep === 'log_set'} message="Enter weight and reps, then tap the check to log the set." />
      <FirstWorkoutTooltip visible={isFirstWorkout && tutorialStep === 'finish'} message="Nice. Tap Finish at the top when you're done." />

      <RestTimer lastSetLoggedAt={lastSetLoggedAt} lastSetWasWarmup={lastSetWasWarmup} />

      <ExercisePickerModal
        visible={showPicker}
        alreadyAdded={activeWorkout.exercises.map(e => e.exerciseId)}
        onSelect={handlePickExercise}
        onClose={() => { setShowPicker(false); setReplacingExerciseId(null); }}
      />
      <TemplatesSheet visible={showTemplates} templates={savedTemplates} onAdd={handleAddTemplateExercises} onClose={() => setShowTemplates(false)} />
      <FinishSheet
        visible={showFinish}
        workoutName={activeWorkout.name}
        duration={elapsed}
        totalSets={allSets.length}
        totalVolume={totalVolume}
        prs={newPRs}
        unit={unit}
        draft={draft}
        onChange={patch => setDraft(d => ({ ...d, ...patch }))}
        finishing={finishing}
        onFinish={finish}
        onClose={() => setShowFinish(false)}
      />
      {nameSheetEl}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: Colors.bg },
  loading: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  // Room at the bottom for the docked rest bar
  scroll: { paddingTop: Spacing.lg, paddingBottom: 120 },
  add: { paddingHorizontal: Spacing.screenH, paddingTop: Spacing.sm },
});
