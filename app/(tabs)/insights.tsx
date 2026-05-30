import { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/colors';
import { parseWorkoutLog, ParsedWorkout } from '@/lib/workoutParser';

interface Message {
  role: 'user' | 'assistant';
  content: string;
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
  const [tab, setTab] = useState<Tab>('coach');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

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

    return [
      `User bodyweight: ${profile?.bodyweight_lbs ?? 'unknown'} lbs`,
      `PRs: ${(prs ?? []).map((p: any) => `${p.exercises?.name} ${p.weight}lbs×${p.reps}`).join(', ')}`,
      `Recent workouts:\n${workoutSummary}`,
    ].join('\n\n');
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || !user) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const context = await buildContext();
      const systemPrompt = `You are a knowledgeable, direct strength coach inside a training tracker app.
You have access to the user's workout history, PRs, and per-set notes. Be concise — 2-4 short paragraphs max.
No bullet lists. Talk like a coach who actually lifts, not a textbook. Call out specific patterns you see.

User context:
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
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Could not reach the AI. Check your connection.',
      }]);
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
      const workouts = parseWorkoutLog(importText, exercises ?? []);
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
        <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginBottom: 12 }}>
          Coach
        </Text>
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
            contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 && (
              <View style={{ gap: 10 }}>
                <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 8, marginTop: 24 }}>
                  Ask your coach anything about your training
                </Text>
                {STARTER_PROMPTS.map((p, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => sendMessage(p)}
                    style={{
                      backgroundColor: Colors.surface,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderWidth: 1,
                      borderColor: Colors.border,
                    }}
                  >
                    <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {messages.map((m, i) => (
              <View key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                marginBottom: 12,
              }}>
                <View style={{
                  backgroundColor: m.role === 'user' ? Colors.accent : Colors.surface,
                  borderRadius: 16,
                  borderBottomRightRadius: m.role === 'user' ? 4 : 16,
                  borderBottomLeftRadius: m.role === 'assistant' ? 4 : 16,
                  padding: 14,
                  borderWidth: m.role === 'assistant' ? 1 : 0,
                  borderColor: Colors.border,
                }}>
                  <Text style={{ color: Colors.text, fontSize: 14, lineHeight: 21 }}>
                    {m.content}
                  </Text>
                </View>
              </View>
            ))}

            {loading && (
              <View style={{ alignSelf: 'flex-start', padding: 14 }}>
                <ActivityIndicator color={Colors.accent} size="small" />
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
                    Works with Google Docs, Apple Notes, or any text format. One workout per date header, exercises with sets like{' '}
                    <Text style={{ color: Colors.textSecondary }}>225x5</Text> or{' '}
                    <Text style={{ color: Colors.textSecondary }}>225x5x3</Text>.
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
    </SafeAreaView>
  );
}
