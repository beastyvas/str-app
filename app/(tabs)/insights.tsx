import { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/colors';

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
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

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

  const handleImport = async () => {
    if (!importText.trim() || !user) return;
    setImporting(true);
    setImportResult(null);

    try {
      const systemPrompt = `You are a workout log parser. The user will paste raw workout notes and you must extract the structured data.

Return ONLY a JSON object with this shape:
{
  "workoutName": "string",
  "exercises": [
    {
      "name": "exercise name exactly matching common gym terminology",
      "sets": [
        { "weight": number, "reps": number, "rpe": number | null, "note": "string | null" }
      ]
    }
  ]
}

Rules:
- Infer exercise names from abbreviations (e.g. "BP" = "Barbell Bench Press", "SQ" = "Barbell Back Squats", "DL" = "Deadlifts")
- If weight is bodyweight, use 0
- If RPE is not mentioned, use null
- Return ONLY valid JSON, no markdown, no explanation`;

      const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-coach', {
        body: {
          systemPrompt,
          messages: [{ role: 'user', content: importText.trim() }],
        },
      });

      if (fnError) throw fnError;
      const raw = fnData?.content?.[0]?.text ?? '';

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error('Could not parse workout. Try formatting it more clearly.');
      }

      setImportResult(JSON.stringify(parsed, null, 2));
      Alert.alert(
        'Parsed!',
        `Found ${parsed.exercises?.length ?? 0} exercises. Review below — save feature coming soon.`,
      );
    } catch (e: any) {
      Alert.alert('Import failed', e.message ?? 'Something went wrong.');
    } finally {
      setImporting(false);
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 6 }}>
              <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700' }}>
                Paste a workout
              </Text>
              <Text style={{ color: Colors.textMuted, fontSize: 13, lineHeight: 19 }}>
                Copy from your notes, a text log, or any format. Claude will parse it into structured sets.
              </Text>
            </View>

            <TextInput
              value={importText}
              onChangeText={setImportText}
              placeholder={`Example:\nBench 225x5, 235x4, 235x3\nSquat 315x3x3 @8\nRDL 275x8x3\nnotes: left knee felt off on squats`}
              placeholderTextColor={Colors.textMuted}
              multiline
              style={{
                backgroundColor: Colors.surface,
                borderRadius: 14,
                padding: 16,
                color: Colors.text,
                fontSize: 14,
                minHeight: 160,
                textAlignVertical: 'top',
                borderWidth: 1,
                borderColor: Colors.border,
                lineHeight: 22,
              }}
            />

            <TouchableOpacity
              onPress={handleImport}
              disabled={!importText.trim() || importing}
              style={{
                backgroundColor: importText.trim() && !importing ? Colors.accent : Colors.surface2,
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: 'center',
              }}
            >
              {importing
                ? <ActivityIndicator color={Colors.text} />
                : <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 15 }}>Parse Workout</Text>
              }
            </TouchableOpacity>

            {importResult && (
              <View style={{
                backgroundColor: Colors.surface,
                borderRadius: 14,
                padding: 16,
                borderWidth: 1,
                borderColor: Colors.border,
              }}>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
                  Parsed Result
                </Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 12, fontFamily: 'monospace', lineHeight: 18 }}>
                  {importResult}
                </Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
