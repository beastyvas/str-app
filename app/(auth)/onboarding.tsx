import { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

type Step = 'gender' | 'bodyweight' | 'experience' | 'goal' | 'style';
const STEPS: Step[] = ['gender', 'bodyweight', 'experience', 'goal', 'style'];

const EXPERIENCE_OPTIONS = [
  { key: 'beginner', label: 'Just starting out', sub: 'Under 1 year training' },
  { key: 'intermediate', label: 'Getting serious', sub: '1–3 years consistent training' },
  { key: 'advanced', label: 'Been in the game', sub: '3+ years, know what works' },
  { key: 'competitive', label: 'I compete', sub: 'Powerlifting, bodybuilding, or CrossFit' },
];

const GOAL_OPTIONS = [
  { key: 'strength', label: 'Get stronger', sub: 'PRs, SBD numbers, raw power', emoji: '🏋️' },
  { key: 'muscle', label: 'Build muscle', sub: 'Hypertrophy, aesthetics, size', emoji: '💪' },
  { key: 'fat_loss', label: 'Lose fat', sub: 'Recomp, cut, drop weight', emoji: '🔥' },
  { key: 'compete', label: 'Compete', sub: 'Working toward a meet or show', emoji: '🥇' },
  { key: 'athletic', label: 'General performance', sub: 'Athletic, healthy, feel good', emoji: '⚡' },
];

const STYLE_OPTIONS = [
  { key: 'powerlifting', label: 'Powerlifting', sub: 'SBD focused, strength first' },
  { key: 'bodybuilding', label: 'Bodybuilding', sub: 'Hypertrophy, isolation, aesthetics' },
  { key: 'hybrid', label: 'Hybrid', sub: 'Mix of strength and size' },
  { key: 'calisthenics', label: 'Calisthenics', sub: 'Bodyweight, rings, skill work' },
  { key: 'athletic', label: 'Athletic / Sport', sub: 'Performance, conditioning, power' },
];

export default function OnboardingScreen() {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>('bodyweight');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [bodyweight, setBodyweight] = useState('');
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
  const [experience, setExperience] = useState('');
  const [goal, setGoal] = useState('');
  const [style, setStyle] = useState('');
  const [saving, setSaving] = useState(false);

  const stepIndex = STEPS.indexOf(step);
  const progress = (stepIndex + 1) / STEPS.length;

  const next = () => {
    const nextStep = STEPS[stepIndex + 1];
    if (nextStep) setStep(nextStep);
  };

  const handleFinish = async () => {
    const bw = parseFloat(bodyweight);
    if (!bw || bw < 50 || bw > 1000) {
      Alert.alert('Check your weight', 'Enter a realistic bodyweight.');
      return;
    }
    setSaving(true);
    try {
      const bwLbs = unit === 'kg' ? bw * 2.205 : bw;
      const { error } = await supabase
        .from('users')
        .update({
          bodyweight_lbs: Math.round(bwLbs * 10) / 10,
          unit_pref: unit,
          gender: gender || null,
          experience_level: experience || null,
          primary_goal: goal || null,
          training_style: style || null,
        })
        .eq('id', user!.id);
      if (error) throw error;
      await refreshProfile();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Progress bar */}
        <View style={{ height: 3, backgroundColor: Colors.surface2, marginTop: 8 }}>
          <View style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: Colors.accent, borderRadius: 2 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 28, paddingTop: 36, flexGrow: 1 }}>

          {/* ── STEP 0: GENDER ─────────────────────────────────────────────── */}
          {step === 'gender' && (
            <View style={{ gap: 24 }}>
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
                  Step 1 of 5
                </Text>
                <Text style={{ color: Colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -1 }}>
                  Who's training?
                </Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 15, marginTop: 8, lineHeight: 22 }}>
                  Strength standards are different for men and women. This makes your rank accurate.
                </Text>
              </View>

              <View style={{ gap: 12 }}>
                {([
                  { key: 'male', label: 'Male', emoji: '⚡' },
                  { key: 'female', label: 'Female', emoji: '⚡' },
                  { key: 'other', label: 'Prefer not to say', emoji: '' },
                ] as const).map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setGender(opt.key)}
                    style={{
                      backgroundColor: gender === opt.key ? Colors.accent + '15' : Colors.surface,
                      borderRadius: 16, padding: 20,
                      borderWidth: 1.5,
                      borderColor: gender === opt.key ? Colors.accent : Colors.border,
                      flexDirection: 'row', alignItems: 'center', gap: 16,
                    }}
                  >
                    <View style={{
                      width: 44, height: 44, borderRadius: 22,
                      backgroundColor: gender === opt.key ? Colors.accent + '25' : Colors.surface2,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 22 }}>{opt.emoji || '–'}</Text>
                    </View>
                    <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '800', flex: 1 }}>{opt.label}</Text>
                    {gender === opt.key && (
                      <Text style={{ color: Colors.accent, fontSize: 20, fontWeight: '900' }}>✓</Text>
                    )}
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
              <TouchableOpacity onPress={() => { setGender('other'); next(); }} style={{ alignItems: 'center' }}>
                <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Skip</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 1: BODYWEIGHT ─────────────────────────────────────────── */}
          {step === 'bodyweight' && (
            <View style={{ gap: 24 }}>
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
                  Step 2 of 5
                </Text>
                <Text style={{ color: Colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -1 }}>
                  First things first.
                </Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 15, marginTop: 8, lineHeight: 22 }}>
                  Your bodyweight powers the strength tier calculations. You can update it anytime.
                </Text>
              </View>

              {/* Unit toggle */}
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
                    <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 }}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 11, letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>
                  Bodyweight ({unit})
                </Text>
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
                    color: Colors.text, fontSize: 36, fontWeight: '800', letterSpacing: -1,
                  }}
                />
              </View>

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

          {/* ── STEP 2: EXPERIENCE ─────────────────────────────────────────── */}
          {step === 'experience' && (
            <View style={{ gap: 24 }}>
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
                  Step 3 of 5
                </Text>
                <Text style={{ color: Colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -1 }}>
                  Where are you in the journey?
                </Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 15, marginTop: 8, lineHeight: 22 }}>
                  Coach adjusts advice based on your experience level.
                </Text>
              </View>

              <View style={{ gap: 10 }}>
                {EXPERIENCE_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setExperience(opt.key)}
                    style={{
                      backgroundColor: experience === opt.key ? Colors.accent + '15' : Colors.surface,
                      borderRadius: 14, padding: 16,
                      borderWidth: 1.5,
                      borderColor: experience === opt.key ? Colors.accent : Colors.border,
                    }}
                  >
                    <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginBottom: 2 }}>{opt.label}</Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{opt.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={next}
                disabled={!experience}
                style={{
                  backgroundColor: experience ? Colors.accent : Colors.surface,
                  borderRadius: 14, paddingVertical: 18, alignItems: 'center',
                  borderWidth: !experience ? 1 : 0, borderColor: Colors.border,
                }}
              >
                <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '900' }}>Continue →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={next} style={{ alignItems: 'center' }}>
                <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Skip for now</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 3: GOAL ───────────────────────────────────────────────── */}
          {step === 'goal' && (
            <View style={{ gap: 24 }}>
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
                  Step 4 of 5
                </Text>
                <Text style={{ color: Colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -1 }}>
                  What are you training for?
                </Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 15, marginTop: 8, lineHeight: 22 }}>
                  This sets the tone for every coaching response.
                </Text>
              </View>

              <View style={{ gap: 10 }}>
                {GOAL_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setGoal(opt.key)}
                    style={{
                      backgroundColor: goal === opt.key ? Colors.accent + '15' : Colors.surface,
                      borderRadius: 14, padding: 16,
                      borderWidth: 1.5,
                      borderColor: goal === opt.key ? Colors.accent : Colors.border,
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{opt.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginBottom: 2 }}>{opt.label}</Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{opt.sub}</Text>
                    </View>
                    {goal === opt.key && (
                      <Text style={{ color: Colors.accent, fontSize: 16, fontWeight: '900' }}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={next}
                disabled={!goal}
                style={{
                  backgroundColor: goal ? Colors.accent : Colors.surface,
                  borderRadius: 14, paddingVertical: 18, alignItems: 'center',
                  borderWidth: !goal ? 1 : 0, borderColor: Colors.border,
                }}
              >
                <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '900' }}>Continue →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={next} style={{ alignItems: 'center' }}>
                <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Skip for now</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 4: STYLE ──────────────────────────────────────────────── */}
          {step === 'style' && (
            <View style={{ gap: 24 }}>
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
                  Step 5 of 5
                </Text>
                <Text style={{ color: Colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -1 }}>
                  How do you train?
                </Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 15, marginTop: 8, lineHeight: 22 }}>
                  Coach speaks your language — whether that's RPE and percentages or sets to failure and pumps.
                </Text>
              </View>

              <View style={{ gap: 10 }}>
                {STYLE_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setStyle(opt.key)}
                    style={{
                      backgroundColor: style === opt.key ? Colors.accent + '15' : Colors.surface,
                      borderRadius: 14, padding: 16,
                      borderWidth: 1.5,
                      borderColor: style === opt.key ? Colors.accent : Colors.border,
                    }}
                  >
                    <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginBottom: 2 }}>{opt.label}</Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{opt.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleFinish}
                disabled={saving}
                style={{
                  backgroundColor: Colors.accent,
                  borderRadius: 14, paddingVertical: 18, alignItems: 'center',
                }}
              >
                {saving
                  ? <ActivityIndicator color={Colors.text} />
                  : <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '900' }}>Let's go 🏋️</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={handleFinish} disabled={saving} style={{ alignItems: 'center' }}>
                <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Skip for now</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
