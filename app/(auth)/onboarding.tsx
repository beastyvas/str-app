import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing } from '@/constants/theme';
import { IconSymbol, PressableScale } from '@/components/ui';
import { useWorld } from '@/theme';
import type { PowerReading } from '@/lib/powerLevel';
import { NameStep } from '@/components/onboarding/NameStep';
import { BodyStep, type Standards } from '@/components/onboarding/BodyStep';
import { LiftStep, type LiftEntry } from '@/components/onboarding/LiftStep';
import { RevealStep } from '@/components/onboarding/RevealStep';
import { useOnboardingSave } from '@/components/onboarding/useOnboardingSave';

type Step = 'name' | 'body' | 'lift' | 'reveal';
const FORM_STEPS: Step[] = ['name', 'body', 'lift'];

/**
 * Three screens + a reveal: name → body → one lift you know → first Power
 * Level reading. Goal / style / training DNA moved to Profile → Training
 * profile; experience level is inferred from the reading.
 */
export default function OnboardingScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const world = useWorld();
  const { save, saving } = useOnboardingSave();

  const [step, setStep] = useState<Step>('name');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState('');
  const [bodyweight, setBodyweight] = useState('');
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
  const [standards, setStandards] = useState<Standards>('male');
  const [entries, setEntries] = useState<LiftEntry[]>([{ lift: 'squat', weight: '', reps: '' }]);
  const [reading, setReading] = useState<PowerReading | null>(null);
  const started = useRef(false);

  const finish = async (withLifts: boolean) => {
    const r = await save({
      userId: user?.id, displayName, username, bodyweight, unit, standards,
      entries: withLifts ? entries : null,
    });
    if (r) { setReading(r); setStep('reveal'); }
  };

  // Navigation to the tabs happens when the refreshed profile has a
  // bodyweight — so we only refresh once the reveal has played.
  const startTraining = async () => {
    if (started.current) return;
    started.current = true;
    try {
      const AS = (await import('@react-native-async-storage/async-storage')).default;
      if (user?.id) await AS.setItem('onboarding_done_' + user.id, 'pending');
    } catch {}
    refreshProfile();
  };

  if (step === 'reveal') {
    return (
      <SafeAreaView style={styles.root}>
        <RevealStep reading={reading} name={displayName.trim().split(' ')[0] || 'lifter'} onStart={startTraining} />
      </SafeAreaView>
    );
  }

  const idx = FORM_STEPS.indexOf(step);
  const back = () => setStep(FORM_STEPS[Math.max(0, idx - 1)]);

  return (
    <SafeAreaView style={styles.root}>
      {/* Thin aura progress bar — no "Step 2 of 6" text */}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${((idx + 1) / (FORM_STEPS.length + 1)) * 100}%`, backgroundColor: world.aura }]} />
      </View>
      <View style={styles.nav}>
        {idx > 0 && (
          <PressableScale onPress={back} style={styles.back} accessibilityLabel="Back">
            <IconSymbol name="chevronBack" size={22} color={Colors.textSecondary} />
          </PressableScale>
        )}
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View key={step} entering={FadeIn.duration(180)} exiting={FadeOut.duration(100)} style={styles.flex}>
            {step === 'name' && (
              <NameStep
                displayName={displayName}
                username={username}
                onChangeName={setDisplayName}
                onChangeUsername={setUsername}
                onNext={() => setStep('body')}
              />
            )}
            {step === 'body' && (
              <BodyStep
                bodyweight={bodyweight}
                unit={unit}
                standards={standards}
                onChangeBodyweight={setBodyweight}
                onChangeUnit={setUnit}
                onChangeStandards={setStandards}
                onNext={() => setStep('lift')}
              />
            )}
            {step === 'lift' && (
              <LiftStep
                entries={entries}
                unit={unit}
                saving={saving}
                onChange={setEntries}
                onFinish={() => finish(true)}
                onSkip={() => finish(false)}
              />
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  track: { height: 3, backgroundColor: Colors.surface2 },
  fill: { height: '100%' },
  nav: { height: 48, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.screenH, paddingBottom: Spacing.xl },
});
