import { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusEffect, useNavigation } from 'expo-router';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Colors } from '@/constants/colors';
import { parseAnyFormat, ParsedWorkout } from '@/lib/workoutParser';
import { PaywallModal } from '@/components/PaywallModal';
import { useChatStore, loadChatHistory, saveChatHistory } from '@/hooks/useChatStore';
import { getAnimeTierResult, TIER_COACH_NAME, TIER_COACH_PERSONALITY, ROMAN } from '@/constants/animeTiers';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

const STARTER_PROMPTS = [
  "What muscle groups am I neglecting?",
  "How's my volume trending this month?",
  "What's my strongest lift relative to bodyweight?",
  "Any signs of overtraining in my recent logs?",
];

type Tab = 'coach' | 'import';

export default function InsightsTab() {
  const { user, profile } = useAuth();
  const { isPro, canAskCoach, aiAsksRemaining, recordAIAsk } = useSubscription();

  // Derive coach identity from user's tier
  const [coachTierKey, setCoachTierKey] = useState('civilian');
  const [coachTierColor, setCoachTierColor] = useState('#F97316');
  const [coachSubTier, setCoachSubTier] = useState(1);

  useEffect(() => {
    if (!user || !profile?.bodyweight_lbs) return;
    supabase
      .from('personal_records')
      .select('weight, reps, achieved_at, exercises!inner(name)')
      .eq('user_id', user.id)
      .in('exercises.name', ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts'])
      .then(({ data }) => {
        const prs = (data ?? []).map((p: any) => ({
          exerciseName: p.exercises?.name ?? '',
          weight: p.weight, reps: p.reps, achievedAt: p.achieved_at,
        }));
        const result = getAnimeTierResult(prs, profile.bodyweight_lbs ?? 185, true);
        setCoachTierKey(result.animeTier.key);
        setCoachTierColor(result.animeTier.color);
        setCoachSubTier(result.subTier);
      });
  }, [user, profile?.bodyweight_lbs]);

  // e.g. "DEMON II Sensei"
  const coachName = (() => {
    const base = TIER_COACH_NAME[coachTierKey] ?? 'Coach';
    // Insert sub-tier before "Sensei": "DEMON Sensei" → "DEMON II Sensei"
    return base.replace(' Sensei', ` ${ROMAN[coachSubTier]} Sensei`);
  })();
  const [showPaywall, setShowPaywall] = useState(false);
  const [tab, setTab] = useState<Tab>('coach');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Chat history — pro users get persistent history, free get one-off
  const { messages, setMessages, addMessage, clearMessages } = useChatStore();
  const historyLoaded = useRef(false);

  // Import tab state
  const [importText, setImportText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsedWorkouts, setParsedWorkouts] = useState<ParsedWorkout[] | null>(null);
  const [allExercises, setAllExercises] = useState<{ id: string; name: string; muscle_group: string }[]>([]);
  // Exercise picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickingTarget, setPickingTarget] = useState<{ wi: number; ei: number } | null>(null);

  // Load chat history for pro users on first focus
  useFocusEffect(useCallback(() => {
    const preFill = (global as any).__coachPreFill;
    if (preFill) {
      (global as any).__coachPreFill = null;
      setTab('coach');
      setTimeout(() => sendMessage(preFill), 100);
    }

    // Pro: load persistent history once
    if (isPro && user && !historyLoaded.current) {
      historyLoaded.current = true;
      loadChatHistory(user.id).then(history => {
        if (history.length > 0) setMessages(history);
      });
    }

    // Free: clear messages every time they come back (one-off)
    if (!isPro) {
      clearMessages();
    }
  }, [isPro, user]));

  const buildContext = async () => {
    const [{ data: prs }, { data: recentWorkouts }] = await Promise.all([
      supabase
        .from('personal_records')
        .select('weight, reps, achieved_at, exercises(name, muscle_group)')
        .eq('user_id', user!.id)
        .order('achieved_at', { ascending: false }),
      supabase
        .from('workouts')
        .select('name, started_at, ended_at, workout_sets(weight, reps, rpe, note, exercises(name))')
        .eq('user_id', user!.id)
        .order('started_at', { ascending: false })
        .limit(10),
    ]);

    const workoutSummary = (recentWorkouts ?? []).map((w: any) => {
      const sets = w.workout_sets ?? [];
      const vol = sets.reduce((s: number, x: any) => s + x.weight * x.reps, 0);
      const notes = sets.filter((s: any) => s.note).map((s: any) => s.note).join(', ');
      return `${w.name} (${new Date(w.started_at).toLocaleDateString()}): ${sets.length} sets, ${vol} lbs volume${notes ? `, notes: ${notes}` : ''}`;
    }).join('\n');

    const GOAL_LABELS: Record<string, string> = {
      strength: 'get stronger (SBD focus)',
      muscle: 'build muscle (hypertrophy)',
      fat_loss: 'lose fat / recomp',
      compete: 'compete (powerlifting or bodybuilding)',
      athletic: 'general athletic performance',
    };
    const EXP_LABELS: Record<string, string> = {
      beginner: 'beginner (under 1 year)',
      intermediate: 'intermediate (1–3 years)',
      advanced: 'advanced (3+ years)',
      competitive: 'competitive athlete',
    };
    const STYLE_LABELS: Record<string, string> = {
      powerlifting: 'powerlifting',
      bodybuilding: 'bodybuilding',
      hybrid: 'hybrid strength/size',
      calisthenics: 'calisthenics',
      athletic: 'athletic/sport performance',
    };

    const athleteProfile = [
      profile?.experience_level ? `Experience: ${EXP_LABELS[profile.experience_level] ?? profile.experience_level}` : null,
      profile?.primary_goal ? `Goal: ${GOAL_LABELS[profile.primary_goal] ?? profile.primary_goal}` : null,
      profile?.training_style ? `Training style: ${STYLE_LABELS[profile.training_style] ?? profile.training_style}` : null,
      profile?.bodyweight_lbs ? `Bodyweight: ${profile.bodyweight_lbs} lbs` : null,
    ].filter(Boolean).join('\n');

    const sections = [
      athleteProfile || `Bodyweight: ${profile?.bodyweight_lbs ?? 'unknown'} lbs`,
      `PRs: ${(prs ?? []).map((p: any) => `${p.exercises?.name} ${p.weight}lbs×${p.reps}`).join(', ') || 'none logged'}`,
      `Recent workouts:\n${workoutSummary}`,
    ];

    if (profile?.training_notes) {
      sections.unshift(`LIFTER PROFILE (read this first):\n${profile.training_notes}`);
    }

    // Pro: include recent chat history so Coach remembers past conversations
    if (isPro && messages.length > 2) {
      const recentHistory = messages
        .slice(-10) // last 10 messages
        .map(m => `${m.role === 'user' ? 'Athlete' : 'Coach'}: ${m.content}`)
        .join('\n');
      sections.push(`RECENT CONVERSATION HISTORY:\n${recentHistory}`);
    }

    return sections.join('\n\n');
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || !user) return;
    if (!canAskCoach) {
      setShowPaywall(true);
      return;
    }
    const allowed = await recordAIAsk();
    if (!allowed) { setShowPaywall(true); return; }
    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: Date.now() };
    addMessage(userMsg);
    setInput('');
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const context = await buildContext();
      const tierPersonality = TIER_COACH_PERSONALITY[coachTierKey] ?? TIER_COACH_PERSONALITY['civilian'];
      const systemPrompt = `You are ${coachName}, a strength and physique coach identity tied to the user's current rank in the STR app.

Tier-specific energy: ${tierPersonality}

Core coaching style (always):
- Direct. No fluff. No corporate wellness speak.
- You've been under the bar. You talk like it.
- Call out specific patterns — RPE trends, recurring notes, recovery signals.
- Real advice only. Never generic filler.
- Know both worlds: powerlifting (SBD, peaking, periodization) AND bodybuilding (hypertrophy, weak points, aesthetics).
- 2-4 short paragraphs max. No bullet lists. No headers. Just talk.

User data:
${context}`;

      const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-coach', {
        body: {
          systemPrompt,
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text.trim() },
          ],
        },
      });

      if (fnError) throw fnError;
      const reply = fnData?.content?.[0]?.text ?? 'Something went wrong. Try again.';
      const assistantMsg: Message = { role: 'assistant', content: reply, timestamp: Date.now() };
      addMessage(assistantMsg);

      // Save history for pro users
      if (isPro && user) {
        const updated = [...useChatStore.getState().messages];
        await saveChatHistory(user.id, updated);
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      const errMsg: Message = { role: 'assistant', content: 'Could not reach the AI. Check your connection.', timestamp: Date.now() };
      addMessage(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleParse = async () => {
    if (!importText.trim()) return;
    setParsing(true);
    setParsedWorkouts(null);
    try {
      const { data: exercises } = await supabase
        .from('exercises')
        .select('id, name, muscle_group')
        .order('name');
      setAllExercises(exercises ?? []);
      const workouts = parseAnyFormat(importText, exercises ?? []);
      if (workouts.length === 0) {
        Alert.alert('Nothing found', 'Could not detect any workouts. Make sure exercises have sets in "Weight x Reps" format.');
        return;
      }
      setParsedWorkouts(workouts);
    } finally {
      setParsing(false);
    }
  };

  // Manually match an exercise from the picker
  const handlePickExercise = (ex: { id: string; name: string }) => {
    if (!pickingTarget || !parsedWorkouts) return;
    const { wi, ei } = pickingTarget;
    const updated = parsedWorkouts.map((w, wIdx) => ({
      ...w,
      exercises: w.exercises.map((e, eIdx) =>
        wIdx === wi && eIdx === ei
          ? { ...e, matchedName: ex.name, matchedId: ex.id }
          : e
      ),
    }));
    setParsedWorkouts(updated);
    setPickerOpen(false);
    setPickerSearch('');
    setPickingTarget(null);
  };

  // Merge duplicate exercises (same matchedId) within each workout
  const mergeExercises = (workouts: ParsedWorkout[]): ParsedWorkout[] => {
    return workouts.map(w => {
      const seen = new Map<string, number>(); // matchedId → index in merged array
      const merged: typeof w.exercises = [];
      for (const ex of w.exercises) {
        if (ex.matchedId && seen.has(ex.matchedId)) {
          // Append sets to existing entry
          merged[seen.get(ex.matchedId)!].sets.push(...ex.sets);
        } else {
          seen.set(ex.matchedId ?? `__${merged.length}`, merged.length);
          merged.push({ ...ex, sets: [...ex.sets] });
        }
      }
      return { ...w, exercises: merged };
    });
  };

  const handleMergeAll = () => {
    if (!parsedWorkouts) return;
    setParsedWorkouts(mergeExercises(parsedWorkouts));
  };

  const handleSaveImport = async () => {
    if (!parsedWorkouts || !user) return;
    setSaving(true);
    let savedCount = 0;
    try {
      // Auto-merge duplicates before saving
      const merged = mergeExercises(parsedWorkouts);
      for (const workout of merged) {
        const { data: wRow, error: wErr } = await supabase
          .from('workouts')
          .insert({
            user_id: user.id,
            name: workout.name,
            started_at: workout.date.toISOString(),
            ended_at: new Date(workout.date.getTime() + 60 * 60 * 1000).toISOString(),
          })
          .select()
          .single();
        if (wErr || !wRow) continue;

        const setsToInsert: any[] = [];
        for (const ex of workout.exercises) {
          if (!ex.matchedId) continue;
          ex.sets.forEach((s, i) => {
            setsToInsert.push({
              workout_id: wRow.id,
              exercise_id: ex.matchedId,
              set_number: i + 1,
              weight: s.weight,
              reps: s.reps,
              rpe: s.rpe ?? null,
              note: s.note ?? null,
              logged_at: new Date(workout.date.getTime() + i * 60000).toISOString(),
            });
          });
        }
        if (setsToInsert.length > 0) {
          await supabase.from('workout_sets').insert(setsToInsert);
        }
        savedCount++;
      }
      setParsedWorkouts(null);
      setImportText('');
      Alert.alert('Imported!', `Saved ${savedCount} workout${savedCount !== 1 ? 's' : ''} to your history.`);
    } catch (e: any) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 0,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: coachTierColor, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
            {coachName}
          </Text>
          {!isPro && (
            <TouchableOpacity
              onPress={() => setShowPaywall(true)}
              style={{
                backgroundColor: Colors.accentDim,
                borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
                borderWidth: 1, borderColor: Colors.accent + '40',
              }}
            >
              <Text style={{ color: Colors.accent, fontSize: 11, fontWeight: '700' }}>
                {aiAsksRemaining > 0 ? `${aiAsksRemaining} asks left · Go Pro` : 'Limit reached · Go Pro'}
              </Text>
            </TouchableOpacity>
          )}
          {isPro && (
            <View style={{ backgroundColor: Colors.accent + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: Colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>PRO</Text>
            </View>
          )}
        </View>
        {/* Tab toggle */}
        <View style={{ flexDirection: 'row', gap: 0 }}>
          {([
            { key: 'coach', label: 'Chat' },
            { key: 'import', label: 'Import Workout' },
          ] as { key: Tab; label: string }[]).map(t => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderBottomWidth: 2,
                borderBottomColor: tab === t.key ? Colors.accent : 'transparent',
                marginRight: 4,
              }}
            >
              <Text style={{
                color: tab === t.key ? Colors.text : Colors.textMuted,
                fontSize: 13,
                fontWeight: tab === t.key ? '700' : '500',
              }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── CHAT TAB ── */}
      {tab === 'coach' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 && (
              <View style={{ gap: 12, paddingTop: 8 }}>
                {/* Coach avatar + intro */}
                <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
                  <View style={{
                    width: 72, height: 72, borderRadius: 36,
                    backgroundColor: coachTierColor + '20',
                    borderWidth: 2, borderColor: coachTierColor + '60',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 32 }}>⚡</Text>
                  </View>
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: coachTierColor, fontSize: 20, fontWeight: '900' }}>
                      {coachName}
                    </Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                      20+ years in the weight room.{'\n'}Reads your logs. Talks like it.
                    </Text>
                  </View>
                  {!isPro && (
                    <View style={{
                      backgroundColor: Colors.surface,
                      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
                      borderWidth: 1, borderColor: Colors.border,
                    }}>
                      <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                        {aiAsksRemaining} free ask{aiAsksRemaining !== 1 ? 's' : ''} left this week
                      </Text>
                    </View>
                  )}
                </View>

                {/* Divider */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
                  <Text style={{ color: Colors.textMuted, fontSize: 11 }}>Ask something</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
                </View>

                {/* Prompt cards — 2 column grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {STARTER_PROMPTS.map((p, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => sendMessage(p)}
                      style={{
                        width: '47%',
                        backgroundColor: Colors.surface,
                        borderRadius: 14,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: Colors.border,
                        gap: 8,
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>
                        {['📊', '💪', '⚖️', '🔄'][i] ?? '⚡'}
                      </Text>
                      <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600', lineHeight: 17 }}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Messages */}
            {messages.map((m, i) => (
              <View key={i} style={{
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                gap: 8,
                marginBottom: 14,
              }}>
                {/* Coach avatar on assistant messages */}
                {m.role === 'assistant' && (
                  <View style={{
                    width: 30, height: 30, borderRadius: 15,
                    backgroundColor: coachTierColor + '20',
                    borderWidth: 1, borderColor: coachTierColor + '40',
                    alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Text style={{ fontSize: 14 }}>⚡</Text>
                  </View>
                )}
                <View style={{ maxWidth: '80%' }}>
                  <View style={{
                    backgroundColor: m.role === 'user' ? Colors.accent : Colors.surface,
                    borderRadius: 18,
                    borderBottomRightRadius: m.role === 'user' ? 4 : 18,
                    borderBottomLeftRadius: m.role === 'assistant' ? 4 : 18,
                    padding: 14,
                    borderWidth: m.role === 'assistant' ? 1 : 0,
                    borderColor: Colors.border,
                  }}>
                    <Text style={{ color: Colors.text, fontSize: 14, lineHeight: 22 }}>
                      {m.content}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            {/* Typing indicator */}
            {loading && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 }}>
                <View style={{
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: Colors.accent + '20',
                  borderWidth: 1, borderColor: Colors.accent + '40',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 14 }}>⚡</Text>
                </View>
                <View style={{
                  backgroundColor: Colors.surface,
                  borderRadius: 18, borderBottomLeftRadius: 4,
                  padding: 14, borderWidth: 1, borderColor: Colors.border,
                }}>
                  <ActivityIndicator color={coachTierColor} size="small" />
                </View>
              </View>
            )}
          </ScrollView>

          <View style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
            backgroundColor: Colors.bg,
            gap: 10,
          }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask your coach..."
              placeholderTextColor={Colors.textMuted}
              multiline
              style={{
                flex: 1,
                backgroundColor: Colors.surface2,
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 10,
                color: Colors.text,
                fontSize: 15,
                maxHeight: 120,
                borderWidth: 1,
                borderColor: Colors.border,
                lineHeight: 20,
              }}
            />
            <TouchableOpacity
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: input.trim() && !loading ? Colors.accent : Colors.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700' }}>↑</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ── IMPORT TAB ── */}
      {tab === 'import' && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

            {!parsedWorkouts ? (
              <>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 6 }}>
                    Paste your workout log
                  </Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 13, lineHeight: 19 }}>
                    Google Docs, Apple Notes, or export CSV from{' '}
                    <Text style={{ color: Colors.textSecondary }}>Hevy</Text> or{' '}
                    <Text style={{ color: Colors.textSecondary }}>Strong</Text>.{' '}
                    Format auto-detected. Sets like 225x5, 70x10(e), 2.25platesx8.
                  </Text>
                </View>

                <TextInput
                  value={importText}
                  onChangeText={setImportText}
                  placeholder={`4/2/24\nBench Press: 225x5, 235x4, 235x4\nSquats: 315x5x3 @8\nRDL: 275x8, 275x8, 275x8\n\n4/4/24\nOHP: 155x5x3\nLat Pulldowns: 150x10, 160x8x2`}
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  style={{
                    backgroundColor: Colors.surface,
                    borderRadius: 14,
                    padding: 16,
                    color: Colors.text,
                    fontSize: 13,
                    minHeight: 200,
                    textAlignVertical: 'top',
                    borderWidth: 1,
                    borderColor: Colors.border,
                    lineHeight: 22,
                    marginBottom: 14,
                  }}
                />

                <TouchableOpacity
                  onPress={handleParse}
                  disabled={!importText.trim() || parsing}
                  style={{
                    backgroundColor: importText.trim() && !parsing ? Colors.accent : Colors.surface2,
                    borderRadius: 12,
                    paddingVertical: 16,
                    alignItems: 'center',
                  }}
                >
                  {parsing
                    ? <ActivityIndicator color={Colors.text} />
                    : <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 15 }}>Parse Log</Text>
                  }
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Preview */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <View>
                    <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800' }}>
                      {parsedWorkouts.length} workout{parsedWorkouts.length !== 1 ? 's' : ''} found
                    </Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      Review before saving
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setParsedWorkouts(null)}>
                    <Text style={{ color: Colors.accent, fontWeight: '700' }}>← Edit</Text>
                  </TouchableOpacity>
                </View>

                {/* Summary row */}
                {(() => {
                  const hasDupes = parsedWorkouts.some(w => {
                    const ids = w.exercises.filter(e => e.matchedId).map(e => e.matchedId);
                    return ids.length !== new Set(ids).size;
                  });
                  return (
                    <>
                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: hasDupes ? 10 : 16 }}>
                        {[
                          { label: 'Workouts', value: parsedWorkouts.length },
                          { label: 'Matched', value: parsedWorkouts.reduce((n, w) => n + w.exercises.filter(e => e.matchedId).length, 0) },
                          { label: 'Sets', value: parsedWorkouts.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0) },
                        ].map((s, i) => (
                          <View key={i} style={{
                            flex: 1, backgroundColor: Colors.surface, borderRadius: 12,
                            padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
                          }}>
                            <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</Text>
                            <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>{s.value}</Text>
                          </View>
                        ))}
                      </View>
                      {hasDupes && (
                        <TouchableOpacity
                          onPress={handleMergeAll}
                          style={{
                            backgroundColor: Colors.accentDim,
                            borderRadius: 10,
                            padding: 12,
                            marginBottom: 16,
                            borderWidth: 1,
                            borderColor: Colors.accent + '40',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                          }}
                        >
                          <Text style={{ color: Colors.accent, fontSize: 13, fontWeight: '700', flex: 1 }}>
                            Duplicate exercises detected — tap to merge sets
                          </Text>
                          <Text style={{ color: Colors.accent, fontWeight: '800' }}>Merge →</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  );
                })()}

                {parsedWorkouts.map((w, wi) => {
                  // Find duplicate matchedIds in this workout
                  const idCounts = new Map<string, number>();
                  w.exercises.forEach(e => { if (e.matchedId) idCounts.set(e.matchedId, (idCounts.get(e.matchedId) ?? 0) + 1); });
                  return (
                  <View key={wi} style={{
                    backgroundColor: Colors.surface,
                    borderRadius: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    overflow: 'hidden',
                  }}>
                    {/* Workout header */}
                    <View style={{
                      padding: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: Colors.border,
                    }}>
                      <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                        {w.name}
                      </Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>
                        {w.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>

                    {/* All exercises — matched and unmatched */}
                    {w.exercises.map((ex, ei) => {
                      const isMatched = !!ex.matchedId;
                      const isDuplicate = isMatched && (idCounts.get(ex.matchedId!) ?? 0) > 1;
                      const topWeight = ex.sets.reduce((m, s) => s.weight > m ? s.weight : m, 0);
                      return (
                        <TouchableOpacity
                          key={ei}
                          onPress={() => {
                            setPickingTarget({ wi, ei });
                            setPickerSearch(isMatched ? '' : ex.rawName.replace(/^[∙•\s\t]+/, '').split('—')[0].trim());
                            setPickerOpen(true);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderBottomWidth: ei < w.exercises.length - 1 ? 1 : 0,
                            borderBottomColor: Colors.border,
                            gap: 10,
                          }}
                        >
                          <View style={{
                            width: 8, height: 8, borderRadius: 4,
                            backgroundColor: isMatched ? Colors.success : Colors.gold,
                          }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{
                              color: isMatched ? Colors.text : Colors.gold,
                              fontSize: 13, fontWeight: '600',
                            }}>
                              {ex.matchedName}
                            </Text>
                            {!isMatched && ex.rawName !== ex.matchedName && (
                              <Text style={{ color: Colors.textMuted, fontSize: 10, marginTop: 1 }} numberOfLines={1}>
                                "{ex.rawName.replace(/^[∙•\s\t]+/, '').slice(0, 50)}"
                              </Text>
                            )}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                              {ex.sets.length} set{ex.sets.length !== 1 ? 's' : ''}
                              {topWeight > 0 ? ` · ${topWeight} lbs` : ''}
                            </Text>
                            <Text style={{
                              color: isDuplicate ? Colors.accent : isMatched ? Colors.textMuted : Colors.gold,
                              fontSize: 10, marginTop: 2,
                            }}>
                              {isDuplicate ? 'duplicate — will merge' : isMatched ? 'tap to change' : 'tap to match →'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  );
                })}

                {/* Exercise picker modal */}
                {pickerOpen && (
                  <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: Colors.bg, zIndex: 100,
                  }}>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center',
                      padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
                    }}>
                      <TextInput
                        value={pickerSearch}
                        onChangeText={setPickerSearch}
                        placeholder="Search exercises..."
                        placeholderTextColor={Colors.textMuted}
                        autoFocus
                        style={{
                          flex: 1,
                          backgroundColor: Colors.surface2,
                          borderRadius: 10,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          color: Colors.text,
                          fontSize: 15,
                          borderWidth: 1,
                          borderColor: Colors.border,
                        }}
                      />
                      <TouchableOpacity onPress={() => { setPickerOpen(false); setPickerSearch(''); }}>
                        <Text style={{ color: Colors.accent, fontWeight: '700', fontSize: 14 }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView keyboardShouldPersistTaps="handled">
                      {allExercises
                        .filter(e => !pickerSearch.trim() || e.name.toLowerCase().includes(pickerSearch.toLowerCase()))
                        .map(ex => (
                          <TouchableOpacity
                            key={ex.id}
                            onPress={() => handlePickExercise(ex)}
                            style={{
                              paddingHorizontal: 20,
                              paddingVertical: 14,
                              borderBottomWidth: 1,
                              borderBottomColor: Colors.border,
                            }}
                          >
                            <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600' }}>
                              {ex.name}
                            </Text>
                            <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>
                              {ex.muscle_group}
                            </Text>
                          </TouchableOpacity>
                        ))
                      }
                    </ScrollView>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleSaveImport}
                  disabled={saving}
                  style={{
                    backgroundColor: saving ? Colors.surface2 : Colors.accent,
                    borderRadius: 12,
                    paddingVertical: 16,
                    alignItems: 'center',
                    marginTop: 4,
                  }}
                >
                  {saving
                    ? <ActivityIndicator color={Colors.text} />
                    : <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 15 }}>
                        Save to STR
                      </Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason={aiAsksRemaining === 0
          ? `You've used your ${3} free AI messages this week. Go Pro for unlimited coaching.`
          : undefined}
      />
    </SafeAreaView>
  );
}
