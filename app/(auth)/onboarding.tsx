import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, Animated, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { getAnimeTierResult, ANIME_TIERS, ROMAN } from '@/constants/animeTiers';
import { TierAdvancementScreen } from '@/components/TierAdvancementScreen';

type Step = 'welcome' | 'identity' | 'gender' | 'bodyweight' | 'goals' | 'sbd' | 'dna' | 'done';
const STEPS: Step[] = ['welcome', 'identity', 'gender', 'bodyweight', 'goals', 'sbd', 'dna', 'done'];

const EXPERIENCE_OPTIONS = [
  { key: 'beginner', label: 'Just starting', sub: 'Under 1 year' },
  { key: 'intermediate', label: 'Getting serious', sub: '1–3 years' },
  { key: 'advanced', label: 'Been in the game', sub: '3+ years' },
  { key: 'competitive', label: 'I compete', sub: 'PL, BB, or CrossFit' },
];

const GOAL_OPTIONS = [
  { key: 'strength', label: 'Get stronger', emoji: '🏋️' },
  { key: 'muscle', label: 'Build muscle', emoji: '💪' },
  { key: 'fat_loss', label: 'Lose fat', emoji: '🔥' },
  { key: 'compete', label: 'Compete', emoji: '🥇' },
  { key: 'athletic', label: 'Stay athletic', emoji: '⚡' },
];

const STYLE_OPTIONS = [
  { key: 'powerlifting', label: 'Powerlifting' },
  { key: 'bodybuilding', label: 'Bodybuilding' },
  { key: 'hybrid', label: 'Hybrid' },
  { key: 'calisthenics', label: 'Calisthenics' },
  { key: 'athletic', label: 'Athletic' },
];

export default function OnboardingScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>('welcome');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Form state
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [bodyweight, setBodyweight] = useState('');
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
  const [experience, setExperience] = useState('');
  const [goal, setGoal] = useState('');
  const [style, setStyle] = useState('');
  const [sbd, setSbd] = useState({ sq: '', bp: '', dl: '' });
  const [dnaText, setDnaText] = useState('');
  const [saving, setSaving] = useState(false);

  // Tier reveal
  const [showTierReveal, setShowTierReveal] = useState(false);
  const [revealTier, setRevealTier] = useState<any>(null);

  const stepIndex = STEPS.indexOf(step);
  const progress = stepIndex / (STEPS.length - 1);

  const animateNext = (nextStep: Step) => {
    // Fade to 0.15 not 0 — prevents black flash
    Animated.timing(fadeAnim, { toValue: 0.15, duration: 120, useNativeDriver: true }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const next = () => {
    const nextStep = STEPS[stepIndex + 1];
    if (nextStep) animateNext(nextStep);
  };

  const skip = () => next();

  const handleFinish = async () => {
    const bw = parseFloat(bodyweight);
    if (!bw) { Alert.alert('Enter your bodyweight to continue'); return; }
    setSaving(true);
    try {
      const bwLbs = unit === 'kg' ? bw * 2.205 : bw;
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');

      // Check for duplicate username before saving
      if (cleanUsername) {
        const { data: taken } = await supabase
          .from('users').select('id').eq('username', cleanUsername).neq('id', user!.id).maybeSingle();
        if (taken) {
          Alert.alert('Username taken', `@${cleanUsername} is already in use. Pick a different handle.`);
          setSaving(false);
          return;
        }
      }

      await supabase.from('users').update({
        display_name: displayName.trim() || null,
        username: cleanUsername || null,
        bodyweight_lbs: Math.round(bwLbs * 10) / 10,
        unit_pref: unit,
        gender: gender || null,
        experience_level: experience || null,
        primary_goal: goal || null,
        training_style: style || null,
        training_notes: dnaText.trim() || null,
      }).eq('id', user!.id);

      // Save SBD maxes as PRs
      const sbdEntries = [
        { name: 'Barbell Back Squats', val: sbd.sq },
        { name: 'Barbell Bench Press', val: sbd.bp },
        { name: 'Deadlifts',           val: sbd.dl },
      ].filter(e => parseFloat(e.val) > 0);

      if (sbdEntries.length > 0) {
        const { data: exRows } = await supabase
          .from('exercises').select('id, name').in('name', sbdEntries.map(e => e.name));
        for (const entry of sbdEntries) {
          const ex = (exRows ?? []).find((e: any) => e.name === entry.name);
          if (!ex) continue;
          await supabase.from('personal_records').upsert({
            user_id: user!.id, exercise_id: ex.id,
            weight: parseFloat(entry.val), reps: 1,
            achieved_at: new Date().toISOString(),
          }, { onConflict: 'user_id,exercise_id' });
        }
        const prs = sbdEntries.map(e => ({
          exerciseName: e.name, weight: parseFloat(e.val), reps: 1,
        }));
        const result = getAnimeTierResult(prs, Math.round(bwLbs * 10) / 10, false, (gender || 'male') as any);
        setRevealTier(result.animeTier);
      } else {
        // No SBD — show NINJA as starting rank
        setRevealTier(ANIME_TIERS[0]);
      }

      setShowTierReveal(true);
      // Note: refreshProfile() is called on the done screen's "Let's get it →"
      // so navigation doesn't fire before the tier reveal animates
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      {/* Progress bar */}
      {step !== 'welcome' && step !== 'done' && (
        <View style={{ height: 3, backgroundColor: Colors.surface2, marginTop: 8 }}>
          <View style={{
            height: '100%',
            width: `${progress * 100}%`,
            backgroundColor: Colors.accent,
            borderRadius: 2,
          }} />
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 28, paddingTop: step === 'welcome' ? 60 : 36 }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ flex: 1, opacity: fadeAnim, gap: 24 }}>

            {/* ── WELCOME ─────────────────────────────────────────────── */}
            {step === 'welcome' && (
              <View style={{ flex: 1, justifyContent: 'space-between' }}>
                <View style={{ gap: 12 }}>
                  <Text style={{
                    color: Colors.accent, fontSize: 72, fontWeight: '900',
                    letterSpacing: -4, lineHeight: 72,
                  }}>
                    STR
                  </Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase' }}>
                    Strength Tracker
                  </Text>
                </View>

                <View style={{ gap: 8, paddingVertical: 40 }}>
                  <Text style={{ color: Colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -1, lineHeight: 38 }}>
                    Your arc{'\n'}starts now.
                  </Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 8 }}>
                    Log every rep. Track every PR.{'\n'}Know exactly where you stand.
                  </Text>
                </View>

                <View style={{ gap: 12 }}>
                  <TouchableOpacity
                    onPress={next}
                    style={{ backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 20, alignItems: 'center' }}
                  >
                    <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>
                      Let's go →
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, textAlign: 'center' }}>
                    Takes about 2 minutes
                  </Text>
                </View>
              </View>
            )}

            {/* ── IDENTITY ────────────────────────────────────────────── */}
            {step === 'identity' && (
              <View style={{ gap: 24 }}>
                <View>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                    Step 1 of 6
                  </Text>
                  <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
                    What do we call you?
                  </Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 14, marginTop: 8, lineHeight: 21 }}>
                    Your name shows on your profile and in the feed. Pick a username so friends can find you.
                  </Text>
                </View>

                <View>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Display Name</Text>
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Nick Vasquez Jr"
                    placeholderTextColor={Colors.textMuted}
                    style={{
                      backgroundColor: Colors.surface, borderRadius: 12,
                      paddingHorizontal: 16, paddingVertical: 14,
                      color: Colors.text, fontSize: 18, fontWeight: '700',
                      borderWidth: 1, borderColor: Colors.border,
                    }}
                  />
                </View>

                <View>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Username</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border }}>
                    <Text style={{ color: Colors.textMuted, fontSize: 16, paddingLeft: 16 }}>@</Text>
                    <TextInput
                      value={username}
                      onChangeText={v => setUsername(v.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                      placeholder="nickjr"
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={{ flex: 1, paddingHorizontal: 8, paddingVertical: 14, color: Colors.text, fontSize: 17, fontWeight: '700' }}
                    />
                  </View>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 6 }}>
                    Friends can find you with @{username || 'yourhandle'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={next}
                  disabled={!displayName.trim()}
                  style={{
                    backgroundColor: displayName.trim() ? Colors.accent : Colors.surface,
                    borderRadius: 14, paddingVertical: 18, alignItems: 'center',
                    borderWidth: !displayName.trim() ? 1 : 0, borderColor: Colors.border,
                  }}
                >
                  <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '900' }}>Continue →</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={next} style={{ alignItems: 'center' }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Set later in profile</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── GENDER ──────────────────────────────────────────────── */}
            {step === 'gender' && (
              <View style={{ gap: 24 }}>
                <View>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                    Step 2 of 6
                  </Text>
                  <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
                    Who's training?
                  </Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 14, marginTop: 8, lineHeight: 21 }}>
                    Strength standards differ for men and women. This makes your rank accurate.
                  </Text>
                </View>

                <View style={{ gap: 10 }}>
                  {([
                    { key: 'male', label: 'Male' },
                    { key: 'female', label: 'Female' },
                    { key: 'other', label: 'Prefer not to say' },
                  ] as const).map(opt => (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setGender(opt.key)}
                      style={{
                        backgroundColor: gender === opt.key ? Colors.accent + '15' : Colors.surface,
                        borderRadius: 14, padding: 18,
                        borderWidth: 1.5,
                        borderColor: gender === opt.key ? Colors.accent : Colors.border,
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '800' }}>{opt.label}</Text>
                      {gender === opt.key && <Text style={{ color: Colors.accent, fontSize: 20 }}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  onPress={next}
                  disabled={!gender}
                  style={{
                    backgroundColor: gender ? Colors.accent : Colors.surface,
                    borderRadius: 14, paddingVertical: 18, alignItems: 'center',
                    borderWidth: !gender ? 1 : 0, borderColor: Colors.border,
                  }}
                >
                  <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '900' }}>Continue →</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={skip} style={{ alignItems: 'center' }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Skip</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── BODYWEIGHT ──────────────────────────────────────────── */}
            {step === 'bodyweight' && (
              <View style={{ gap: 24 }}>
                <View>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                    Step 3 of 6
                  </Text>
                  <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
                    Your bodyweight.
                  </Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 14, marginTop: 8, lineHeight: 21 }}>
                    Powers the strength tier calculations. Update it anytime.
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['lbs', 'kg'] as const).map(u => (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setUnit(u)}
                      style={{
                        flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
                        backgroundColor: unit === u ? Colors.accent : Colors.surface,
                        borderWidth: 1, borderColor: unit === u ? Colors.accent : Colors.border,
                      }}
                    >
                      <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 }}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  value={bodyweight}
                  onChangeText={setBodyweight}
                  keyboardType="decimal-pad"
                  placeholder={unit === 'lbs' ? '185' : '84'}
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    backgroundColor: Colors.surface, borderColor: Colors.border,
                    borderWidth: 1, borderRadius: 14,
                    paddingHorizontal: 20, paddingVertical: 18,
                    color: Colors.text, fontSize: 40, fontWeight: '800', letterSpacing: -1,
                    textAlign: 'center',
                  }}
                />

                <TouchableOpacity
                  onPress={next}
                  disabled={!bodyweight}
                  style={{
                    backgroundColor: bodyweight ? Colors.accent : Colors.surface,
                    borderRadius: 14, paddingVertical: 18, alignItems: 'center',
                    borderWidth: !bodyweight ? 1 : 0, borderColor: Colors.border,
                  }}
                >
                  <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '900' }}>Continue →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── GOALS ───────────────────────────────────────────────── */}
            {step === 'goals' && (
              <View style={{ gap: 20 }}>
                <View>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                    Step 4 of 6
                  </Text>
                  <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
                    What are you training for?
                  </Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 14, marginTop: 8 }}>
                    Coach speaks your language based on this.
                  </Text>
                </View>

                {/* Experience */}
                <View style={{ gap: 8 }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>Experience</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {EXPERIENCE_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => setExperience(opt.key)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                          backgroundColor: experience === opt.key ? Colors.accent + '20' : Colors.surface,
                          borderWidth: 1, borderColor: experience === opt.key ? Colors.accent : Colors.border,
                        }}
                      >
                        <Text style={{ color: experience === opt.key ? Colors.accent : Colors.text, fontWeight: '700', fontSize: 13 }}>
                          {opt.label}
                        </Text>
                        <Text style={{ color: Colors.textMuted, fontSize: 10, marginTop: 2 }}>{opt.sub}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Goal */}
                <View style={{ gap: 8 }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>Primary Goal</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {GOAL_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => setGoal(opt.key)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                          backgroundColor: goal === opt.key ? Colors.accent + '20' : Colors.surface,
                          borderWidth: 1, borderColor: goal === opt.key ? Colors.accent : Colors.border,
                          flexDirection: 'row', alignItems: 'center', gap: 8,
                        }}
                      >
                        <Text style={{ fontSize: 16 }}>{opt.emoji}</Text>
                        <Text style={{ color: goal === opt.key ? Colors.accent : Colors.text, fontWeight: '700', fontSize: 13 }}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Style */}
                <View style={{ gap: 8 }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>Training Style</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {STYLE_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => setStyle(opt.key)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                          backgroundColor: style === opt.key ? Colors.accent + '20' : Colors.surface,
                          borderWidth: 1, borderColor: style === opt.key ? Colors.accent : Colors.border,
                        }}
                      >
                        <Text style={{ color: style === opt.key ? Colors.accent : Colors.text, fontWeight: '700', fontSize: 13 }}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={next}
                  style={{ backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}
                >
                  <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '900' }}>Continue →</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={skip} style={{ alignItems: 'center' }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Skip for now</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── SBD RANK SETUP ──────────────────────────────────────── */}
            {step === 'sbd' && (
              <View style={{ gap: 24 }}>
                <View>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                    Step 5 of 6
                  </Text>
                  <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
                    What are your{'\n'}best lifts?
                  </Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 14, marginTop: 8, lineHeight: 21 }}>
                    Enter your best single or a heavy set. This sets your starting rank.
                  </Text>
                </View>

                {/* Live tier preview */}
                {(parseFloat(sbd.sq) > 0 || parseFloat(sbd.bp) > 0 || parseFloat(sbd.dl) > 0) && (() => {
                  const bwLbs = unit === 'kg' ? parseFloat(bodyweight || '185') * 2.205 : parseFloat(bodyweight || '185');
                  const prs = [
                    { exerciseName: 'Barbell Back Squats', weight: parseFloat(sbd.sq) || 0, reps: 1 },
                    { exerciseName: 'Barbell Bench Press', weight: parseFloat(sbd.bp) || 0, reps: 1 },
                    { exerciseName: 'Deadlifts', weight: parseFloat(sbd.dl) || 0, reps: 1 },
                  ].filter(p => p.weight > 0);
                  if (prs.length === 0) return null;
                  const result = getAnimeTierResult(prs, bwLbs, false, (gender || 'male') as any);
                  return (
                    <View style={{
                      backgroundColor: result.animeTier.color + '15',
                      borderRadius: 14, padding: 16,
                      borderWidth: 1, borderColor: result.animeTier.color + '40',
                      alignItems: 'center', gap: 4,
                    }}>
                      <Text style={{ color: result.animeTier.color, fontSize: 22, fontWeight: '900', letterSpacing: 1.5 }}>
                        {result.animeTier.label} {ROMAN[result.subTier]}
                      </Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 12, fontStyle: 'italic' }}>
                        "{result.animeTier.tagline}"
                      </Text>
                    </View>
                  );
                })()}

                {[
                  { label: 'Squat', key: 'sq' as const, placeholder: '315' },
                  { label: 'Bench', key: 'bp' as const, placeholder: '225' },
                  { label: 'Deadlift', key: 'dl' as const, placeholder: '405' },
                ].map(({ label, key, placeholder }) => (
                  <View key={key}>
                    <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
                      {label} ({unit})
                    </Text>
                    <TextInput
                      value={sbd[key]}
                      onChangeText={v => setSbd(prev => ({ ...prev, [key]: v }))}
                      keyboardType="number-pad"
                      placeholder={placeholder}
                      placeholderTextColor={Colors.textMuted}
                      style={{
                        backgroundColor: Colors.surface, borderRadius: 12,
                        paddingHorizontal: 16, paddingVertical: 14,
                        color: Colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -1,
                        borderWidth: 1, borderColor: Colors.border,
                      }}
                    />
                  </View>
                ))}

                <TouchableOpacity
                  onPress={next}
                  style={{ backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}
                >
                  <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '900' }}>Continue →</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={skip} style={{ alignItems: 'center' }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Skip — I'll set this later</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── LIFTER DNA ───────────────────────────────────────────── */}
            {step === 'dna' && (
              <View style={{ gap: 24 }}>
                <View>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                    Step 6 of 6
                  </Text>
                  <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
                    Tell Coach{'\n'}about you.
                  </Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 14, marginTop: 8, lineHeight: 21 }}>
                    Coach reads this before every response. Injuries, history, what works — the more detail, the better the advice.
                  </Text>
                </View>

                {/* Example prompts */}
                <View style={{
                  backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
                  borderWidth: 1, borderColor: Colors.border,
                }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6, letterSpacing: 1 }}>
                    EXAMPLE
                  </Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 12, lineHeight: 18 }}>
                    "3 years training, mostly bodybuilding. Left shoulder impingement — flat pressing hurts at the bottom. Bench has always been behind. Goal is to compete in 2 years. Sleep is inconsistent..."
                  </Text>
                </View>

                <TextInput
                  value={dnaText}
                  onChangeText={setDnaText}
                  multiline
                  placeholder="What should Coach know about you?"
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    backgroundColor: Colors.surface, borderRadius: 14,
                    padding: 16, color: Colors.text, fontSize: 15,
                    minHeight: 140, textAlignVertical: 'top',
                    borderWidth: 1, borderColor: Colors.border, lineHeight: 22,
                  }}
                />

                <TouchableOpacity
                  onPress={handleFinish}
                  disabled={saving}
                  style={{ backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}
                >
                  {saving
                    ? <ActivityIndicator color={Colors.text} />
                    : <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '900' }}>Let's go 🏋️</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={handleFinish} disabled={saving} style={{ alignItems: 'center' }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Skip — enter later in profile</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── DONE ────────────────────────────────────────────────── */}
            {step === 'done' && (
              <View style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 40 }}>
                <View />
                <View style={{ alignItems: 'center', gap: 20 }}>
                  {/* Big animated emoji */}
                  <Text style={{ fontSize: 72 }}>🏆</Text>

                  <View style={{ alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: Colors.text, fontSize: 34, fontWeight: '900', textAlign: 'center', letterSpacing: -1 }}>
                      You're in.
                    </Text>
                    <Text style={{ color: Colors.accent, fontSize: 15, fontWeight: '700', textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase' }}>
                      Your arc begins now
                    </Text>
                  </View>

                  <View style={{
                    backgroundColor: Colors.surface, borderRadius: 16, padding: 20,
                    borderWidth: 1, borderColor: Colors.border, gap: 12, width: '100%',
                  }}>
                    {[
                      { emoji: '🏋️', text: 'Log your first workout' },
                      { emoji: '⚡', text: 'Get your weekly plan from Coach' },
                      { emoji: '👥', text: 'Add your first friend' },
                    ].map((item, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                        <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: '600' }}>{item.text}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                    Three quick tasks wait on your home screen.{'\n'}Every PR tracked. Every rank earned.
                  </Text>
                </View>

                <View style={{ width: '100%', gap: 12 }}>
                  {/* Creator shoutout */}
                  <View style={{
                    backgroundColor: Colors.surface,
                    borderRadius: 14, padding: 16,
                    borderWidth: 1, borderColor: Colors.border,
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                  }}>
                    <Text style={{ fontSize: 32 }}>👋</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '800', marginBottom: 2 }}>
                        Built by Nick Vasquez Jr
                      </Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 11, lineHeight: 16 }}>
                        If STR helps your training, follow along — I post updates, features, and lifting content.
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://instagram.com/beastyvas')}
                    style={{
                      backgroundColor: Colors.surface,
                      borderRadius: 12, paddingVertical: 14,
                      alignItems: 'center', flexDirection: 'row',
                      justifyContent: 'center', gap: 10,
                      borderWidth: 1, borderColor: Colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>📸</Text>
                    <Text style={{ color: Colors.textSecondary, fontWeight: '700', fontSize: 14 }}>
                      Follow @beastyvas on Instagram
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={async () => { try { const AS = (await import('@react-native-async-storage/async-storage')).default; if (user?.id) await AS.setItem('onboarding_done_' + user.id, 'pending'); } catch {} refreshProfile(); }}
                    style={{ backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 20, alignItems: 'center' }}
                  >
                    <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '900', letterSpacing: 0.3 }}>
                      Let's get it →
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Tier reveal animation */}
      <TierAdvancementScreen
        visible={showTierReveal}
        tier={revealTier}
        subTier={1}
        isSubTierAdvance={false}
        onDismiss={() => {
          setShowTierReveal(false);
          animateNext('done');
        }}
      />
    </SafeAreaView>
  );
}
