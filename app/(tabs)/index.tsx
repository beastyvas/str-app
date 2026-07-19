import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing } from '@/constants/theme';
import { CelebrationToast } from '@/components/CelebrationToast';
import { TierLadderModal } from '@/components/TierLadderModal';
import { useSubscription } from '@/hooks/useSubscription';
import { toLbs, unitFromProfile } from '@/lib/units';
import { useHomeData, WorkoutDayData } from '@/hooks/useHomeData';
import {
  FirstStepsCard,
  FriendActivityCard,
  HomeHeader,
  HomeSkeleton,
  LastWorkoutCard,
  RankHeroCard,
  SbdEntrySheet,
  SbdInputs,
  StartWorkoutCTA,
  TodayPlanCard,
  WeekdayDetailSheet,
  WeeklyPlanSheet,
  getSmartGreetingLine,
} from '@/components/home';

export default function HomeScreen() {
  const { profile, user } = useAuth();
  const unit = unitFromProfile(profile?.unit_pref);
  const isNewLifter = !profile?.experience_level || profile.experience_level === 'beginner';
  const { isPro, aiAsksRemaining } = useSubscription();
  const router = useRouter();

  // All Home data (SWR-cached: instant render on refocus, silent background
  // refresh, skeleton only on true first load) lives in useHomeData.
  const { data, loading, celebration, clearCelebration, refetch, markCoachStepDone } = useHomeData();

  const [weeklyPlanModal, setWeeklyPlanModal] = useState(false);
  const [trainingDays, setTrainingDays] = useState('4');
  const [selectedDayWorkout, setSelectedDayWorkout] = useState<(WorkoutDayData & { dow: number }) | null>(null);
  const [showTierLadder, setShowTierLadder] = useState(false);
  const [sbdModalOpen, setSbdModalOpen] = useState(false);
  const [sbdInputs, setSbdInputs] = useState<SbdInputs>({ sq: '', bp: '', dl: '' });
  const [sbdSaving, setSbdSaving] = useState(false);

  const saveSBD = async () => {
    if (!user) return;
    const entries = [
      { key: 'barbell back squats', val: sbdInputs.sq, name: 'Barbell Back Squats' },
      { key: 'barbell bench press', val: sbdInputs.bp, name: 'Barbell Bench Press' },
      { key: 'deadlifts',           val: sbdInputs.dl, name: 'Deadlifts' },
    ].filter(e => parseFloat(e.val) > 0);

    if (entries.length === 0) { Alert.alert('Enter at least one lift'); return; }
    setSbdSaving(true);
    try {
      const { data: exRows } = await supabase
        .from('exercises')
        .select('id, name')
        .in('name', entries.map(e => e.name));
      if (!exRows?.length) throw new Error('Exercises not found');

      for (const entry of entries) {
        const ex = exRows.find(e => e.name.toLowerCase() === entry.key);
        if (!ex) continue;
        await supabase.from('personal_records').upsert({
          user_id: user.id,
          exercise_id: ex.id,
          // Typed in the user's display unit — stored canonical lbs
          weight: toLbs(parseFloat(entry.val), unit),
          reps: 1,
          achieved_at: new Date().toISOString(),
        }, { onConflict: 'user_id,exercise_id' });
      }

      setSbdModalOpen(false);
      setSbdInputs({ sq: '', bp: '', dl: '' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSbdSaving(false);
    }
  };

  const goToCoachWithQuestion = (question: string) => {
    if (isPro) {
      (global as any).__coachPreFill = question;
      router.push('/(tabs)/insights');
    } else {
      Alert.alert('Ask Coach', `Uses 1 of your ${aiAsksRemaining} weekly asks.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Ask', onPress: () => { (global as any).__coachPreFill = question; router.push('/(tabs)/insights'); } },
      ]);
    }
  };

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
    const msg = `Build me a personalized ${trainingDays}-day per week workout program. I'm ${profile?.experience_level ?? 'intermediate'} level, training for ${profile?.primary_goal ?? 'general fitness'}, with a ${profile?.training_style ?? 'hybrid'} style. Give me specific days (e.g. Monday/Wednesday/Friday), exercises with sets and reps, and rest days. Make it progressive and realistic.`;
    (global as any).__coachPreFill = msg;
    router.push('/(tabs)/insights');
  };

  // Skeleton only on true first load — refocus renders cached data instantly.
  if (loading && !data) {
    return <HomeSkeleton />;
  }

  const rankResult = data?.rankResult ?? null;
  const firstSteps = data?.firstSteps ?? null;
  const lastWorkout = data?.lastWorkout ?? null;
  const workoutDays = data?.workoutDays ?? {};

  // Today's planned session from the configured split; once today's workout is
  // logged we fall through to the weekly recap instead of nagging.
  const todayDow = new Date().getDay();
  const todaySession: string | null = workoutDays[todayDow]
    ? null
    : ((profile as any)?.split_schedule as Record<string, string> | null)?.[String(todayDow)] ?? null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.screenH, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader
          firstName={profile?.display_name?.split(' ')[0] ?? 'Athlete'}
          avatarUrl={profile?.avatar_url}
          greeting={getSmartGreetingLine(lastWorkout, todaySession)}
          onAvatarPress={() => router.push('/(tabs)/profile')}
        />

        {rankResult && (
          <RankHeroCard
            rankResult={rankResult}
            // Unranked lifters get sent straight to SBD entry; ranked ones
            // open the ladder (Home previously had no path to SBD entry at all)
            onOpenLadder={() => (rankResult.avgScore > 0 ? setShowTierLadder(true) : setSbdModalOpen(true))}
            onAskCoach={goToCoachWithQuestion}
          />
        )}

        <TodayPlanCard
          todaySession={todaySession}
          workoutDays={workoutDays}
          onStartWorkout={() => router.push('/(tabs)/workout')}
          onSelectDay={setSelectedDayWorkout}
        />

        {firstSteps && (
          <FirstStepsCard
            firstSteps={firstSteps}
            isNewLifter={isNewLifter}
            onStartFirstWorkout={() => {
              (global as any).__startFirstWorkout = true;
              router.push('/(tabs)/workout');
            }}
            onCoachStep={handleCoachStep}
            onAddFriend={() => {
              if (firstSteps.hasFriend) return;
              if (data?.creatorId) {
                (global as any).__openFriendProfile = data.creatorId;
              }
              router.push('/(tabs)/friends');
            }}
          />
        )}

        <StartWorkoutCTA onPress={() => router.push('/(tabs)/workout')} />

        {lastWorkout && (
          <LastWorkoutCard
            lastWorkout={lastWorkout}
            unit={unit}
            onPress={() => router.push('/(tabs)/history')}
          />
        )}

        <FriendActivityCard
          post={data?.recentFriendPost ?? null}
          onPress={() => router.push('/(tabs)/friends')}
        />

        <View style={{ height: Spacing.sm }} />
      </ScrollView>

      {/* Sheets & overlays */}
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
        result={rankResult}
        bodyweightLbs={profile?.bodyweight_lbs ?? 185}
        gender={profile?.gender}
      />
      <SbdEntrySheet
        visible={sbdModalOpen}
        unit={unit}
        inputs={sbdInputs}
        saving={sbdSaving}
        onChange={setSbdInputs}
        onSave={saveSBD}
        onClose={() => setSbdModalOpen(false)}
      />
      <WeekdayDetailSheet
        day={selectedDayWorkout}
        unit={unit}
        onClose={() => setSelectedDayWorkout(null)}
      />
      <CelebrationToast
        visible={!!celebration}
        emoji={celebration?.emoji ?? '🎉'}
        title={celebration?.title ?? ''}
        sub={celebration?.sub}
        onDone={clearCelebration}
      />
    </SafeAreaView>
  );
}
