import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
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

// PR localId → isPR lookup, built as sets come in
type PRMap = Record<string, boolean>;

export default function WorkoutTab() {
  const router = useRouter();
  const { user } = useAuth();

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
  const [elapsedSec, setElapsedSec] = useState(0);
  const [prevSetsCache, setPrevSetsCache] = useState<Record<string, any[]>>({});
  const [lastWorkoutExercises, setLastWorkoutExercises] = useState<{ id: string; name: string; muscle_group: string }[]>([]);

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

  // ─── LOAD LAST WORKOUT EXERCISES ─────────────────────────────────────────
  useEffect(() => {
    if (!user || activeWorkout) return;
    supabase
      .from('workouts')
      .select('workout_sets(exercise_id, exercises(id, name, muscle_group))')
      .eq('user_id', user.id)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const seen = new Set<string>();
        const exercises: { id: string; name: string; muscle_group: string }[] = [];
        for (const s of (data.workout_sets as any[]) ?? []) {
          const ex = s.exercises;
          if (ex && !seen.has(ex.id)) {
            seen.add(ex.id);
            exercises.push({ id: ex.id, name: ex.name, muscle_group: ex.muscle_group });
          }
        }
        setLastWorkoutExercises(exercises);
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

  const handleStartConfirm = async (repeatLast = false) => {
    if (!user || !workoutName.trim()) return;
    setShowNameModal(false);
    try {
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
  if (!activeWorkout) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ color: Colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -1, textAlign: 'center', marginBottom: 12 }}>
            Ready to{'\n'}train?
          </Text>
          <Text style={{ color: Colors.textMuted, fontSize: 15, textAlign: 'center', marginBottom: 48, lineHeight: 22 }}>
            Start a session and log every set.{'\n'}PRs tracked automatically.
          </Text>
          <TouchableOpacity
            onPress={handleStartPress}
            style={{
              backgroundColor: Colors.accent,
              borderRadius: 16,
              paddingVertical: 18,
              paddingHorizontal: 48,
              marginBottom: 14,
            }}
          >
            <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>
              START WORKOUT
            </Text>
          </TouchableOpacity>
          {lastWorkoutExercises.length > 0 && (
            <TouchableOpacity
              onPress={handleRepeatLast}
              style={{
                borderRadius: 16,
                paddingVertical: 14,
                paddingHorizontal: 32,
                borderWidth: 1,
                borderColor: Colors.border,
                backgroundColor: Colors.surface,
              }}
            >
              <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: '700' }}>
                ↩ Repeat last workout
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Name modal */}
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
                onSubmitEditing={handleStartConfirm}
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
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: Colors.surface2,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: Colors.textMuted, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleStartConfirm(false)}
                  disabled={!workoutName.trim()}
                  style={{
                    flex: 2,
                    paddingVertical: 14,
                    borderRadius: 12,
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
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: Colors.gold + '30',
        }}>
          <Text style={{ color: Colors.gold, fontSize: 13, fontWeight: '800' }}>
            🏆 {newPRs.map(p => `${p.exerciseName} PR!`).join('  ')}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {activeWorkout.exercises.length === 0 && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontSize: 15, textAlign: 'center' }}>
              No exercises yet.{'\n'}Tap + to add your first exercise.
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

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowFinishModal(false)}
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 14,
                  backgroundColor: Colors.surface2,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: Colors.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleFinishConfirm}
                style={{
                  flex: 2,
                  paddingVertical: 16,
                  borderRadius: 14,
                  backgroundColor: Colors.accent,
                  alignItems: 'center',
                }}
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
