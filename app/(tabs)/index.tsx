import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { CelebrationToast } from '@/components/CelebrationToast';
import { TierLadderModal } from '@/components/TierLadderModal';
import { useCameoStore } from '@/components/cameo';
import { PowerHero } from '@/components/power/PowerHero';
import { unitFromProfile } from '@/lib/units';
import { useHomeData, WorkoutDayData } from '@/hooks/useHomeData';
import {
  FirstStepsRow, FriendsTodayRow, GreetingBar, HomeSkeleton, LastWorkoutRow, TodayBlock,
  WeekdayDetailSheet, WeeklyPlanSheet, getSmartGreetingLine,
} from '@/components/home';

/**
 * Home: one greeting line, the Power Level hero, a single "Today" block with
 * Start workout inside, then one row each for the last workout and friends.
 * Data is SWR-cached in useHomeData (skeleton only on a true first load).
 */
export default function HomeScreen() {
  const { profile, user } = useAuth();
  const world = useWorld();
  const unit = unitFromProfile(profile?.unit_pref);
  const isNewLifter = !profile?.experience_level || profile.experience_level === 'beginner';
  const router = useRouter();
  const { data, loading, celebration, clearCelebration, refetch, markCoachStepDone } = useHomeData();

  const [weeklyPlanModal, setWeeklyPlanModal] = useState(false);
  const [trainingDays, setTrainingDays] = useState('4');
  const [selectedDay, setSelectedDay] = useState<(WorkoutDayData & { dow: number }) | null>(null);
  const [showTierLadder, setShowTierLadder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const firstName = profile?.display_name?.split(' ')[0] ?? 'lifter';

  // Random Home drop-in: ~20% once a day, never on a rank-up day.
  const weakest = data?.power?.weakest ?? undefined;
  useFocusEffect(useCallback(() => {
    if (!data) return;
    useCameoStore.getState().maybeHomeDropin({ name: firstName, weakest });
  }, [!!data, weakest]));

  // First Steps "coach" task — completion semantics unchanged.
  const handleCoachStep = () => {
    if (data?.firstSteps?.hasCoach) return;
    if (isNewLifter) {
      // Beginners already have a starter plan — their step is just meeting Coach
      if (user) {
        import('@react-native-async-storage/async-storage')
          .then(({ default: AS }) => AS.setItem(`weekly_plan_done_${user.id}`, 'true'));
        supabase.from('users').update({ weekly_plan_done: true }).eq('id', user.id).then(() => {});
      }
      markCoachStepDone();
      router.push('/(tabs)/insights');
    } else {
      setWeeklyPlanModal(true);
    }
  };

  const buildWeeklyPlan = async () => {
    setWeeklyPlanModal(false);
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    if (user) {
      await AsyncStorage.setItem(`weekly_plan_done_${user.id}`, 'true');
      await AsyncStorage.setItem(`celebrated_plan_${user.id}`, 'pending');
      // Durable server flag so the task doesn't reset on re-login/reinstall
      await supabase.from('users').update({ weekly_plan_done: true }).eq('id', user.id);
    }
    markCoachStepDone();
    (global as any).__coachPreFill = `Build me a personalized ${trainingDays}-day per week workout program. I'm ${profile?.experience_level ?? 'intermediate'} level, training for ${profile?.primary_goal ?? 'general fitness'}, with a ${profile?.training_style ?? 'hybrid'} style. Give me specific days (e.g. Monday/Wednesday/Friday), exercises with sets and reps, and rest days. Make it progressive and realistic.`;
    router.push('/(tabs)/insights');
  };

  if (loading && !data) return <HomeSkeleton />;

  const lastWorkout = data?.lastWorkout ?? null;
  const workoutDays = data?.workoutDays ?? {};
  const todayDow = new Date().getDay();
  const split = (profile as any)?.split_schedule as Record<string, string> | null;
  const trainedToday = !!workoutDays[todayDow];
  const todaySession = trainedToday ? null : split?.[String(todayDow)] ?? null;
  const goTrain = () => router.push('/(tabs)/workout');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={world.aura}
            onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }}
          />
        }
      >
        <GreetingBar
          greeting={getSmartGreetingLine(firstName, lastWorkout, todaySession)}
          avatarUrl={profile?.avatar_url}
          initial={firstName.charAt(0).toUpperCase()}
          onAvatarPress={() => router.push('/(tabs)/profile')}
        />

        <PowerHero reading={data?.power ?? null} onOpenLadder={() => setShowTierLadder(true)} onStartWorkout={goTrain} />

        <TodayBlock
          todaySession={todaySession}
          trainedToday={trainedToday}
          hasSplit={!!split && Object.keys(split).length > 0}
          workoutDays={workoutDays}
          onStartWorkout={goTrain}
          onSelectDay={setSelectedDay}
        />

        {data?.firstSteps && (
          <FirstStepsRow
            firstSteps={data.firstSteps}
            isNewLifter={isNewLifter}
            onStartFirstWorkout={() => { (global as any).__startFirstWorkout = true; goTrain(); }}
            onCoachStep={handleCoachStep}
            onAddFriend={() => {
              if (data.firstSteps?.hasFriend) return;
              if (data.creatorId) (global as any).__openFriendProfile = data.creatorId;
              router.push('/(tabs)/friends');
            }}
          />
        )}

        {lastWorkout && <LastWorkoutRow lastWorkout={lastWorkout} onPress={() => router.push('/(tabs)/history')} />}
        <FriendsTodayRow friends={data?.friendsToday ?? []} onPress={() => router.push('/(tabs)/friends')} />
      </ScrollView>

      <WeeklyPlanSheet
        visible={weeklyPlanModal}
        trainingDays={trainingDays}
        onChangeDays={setTrainingDays}
        onBuild={buildWeeklyPlan}
        onClose={() => setWeeklyPlanModal(false)}
      />
      <TierLadderModal
        visible={showTierLadder}
        onClose={() => setShowTierLadder(false)}
        result={data?.rankResult ?? null}
        bodyweightLbs={profile?.bodyweight_lbs ?? 185}
        gender={profile?.gender}
      />
      <WeekdayDetailSheet day={selectedDay} unit={unit} onClose={() => setSelectedDay(null)} />
      <CelebrationToast visible={!!celebration} title={celebration?.title ?? ''} sub={celebration?.sub} onDone={clearCelebration} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.screenH, paddingBottom: 48, gap: Spacing.group },
});
