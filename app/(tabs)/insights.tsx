import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
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
  "How's my squat progressing?",
  "What's my strongest lift relative to bodyweight?",
  "Give me a deload week recommendation",
];

export default function InsightsTab() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || !user) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Gather context: PRs + recent workouts
      const [{ data: prs }, { data: recentWorkouts }] = await Promise.all([
        supabase
          .from('personal_records')
          .select('weight, reps, achieved_at, exercises(name, muscle_group)')
          .eq('user_id', user.id)
          .order('achieved_at', { ascending: false }),
        supabase
          .from('workouts')
          .select('name, started_at, ended_at, workout_sets(weight, reps, exercises(name))')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(5),
      ]);

      const context = [
        `User bodyweight: ${profile?.bodyweight_lbs ?? 'unknown'} lbs`,
        `PRs: ${(prs ?? []).map((p: any) => `${p.exercises?.name} ${p.weight}lbs×${p.reps}`).join(', ')}`,
        `Recent workouts (last 5): ${(recentWorkouts ?? []).map((w: any) => w.name).join(', ')}`,
      ].join('\n');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          system: `You are a knowledgeable, direct strength coach inside a training tracker app.
You have access to the user's workout history and PRs. Be concise — 2-4 short paragraphs max.
No bullet lists, no fluff. Talk like a coach, not a textbook.

User context:
${context}`,
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text.trim() },
          ],
        }),
      });

      const json = await response.json();
      const reply = json.content?.[0]?.text ?? 'Something went wrong. Try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Could not reach the AI. Check your connection and API key.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
      }}>
        <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
          Coach
        </Text>
        <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>
          AI analysis of your training
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Empty state — starter prompts */}
          {messages.length === 0 && (
            <View style={{ gap: 10 }}>
              <Text style={{
                color: Colors.textMuted,
                fontSize: 13,
                textAlign: 'center',
                marginBottom: 8,
                marginTop: 24,
              }}>
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

          {/* Message thread */}
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
                <Text style={{
                  color: Colors.text,
                  fontSize: 14,
                  lineHeight: 21,
                }}>
                  {m.content}
                </Text>
              </View>
            </View>
          ))}

          {/* Loading indicator */}
          {loading && (
            <View style={{ alignSelf: 'flex-start', padding: 14 }}>
              <ActivityIndicator color={Colors.accent} size="small" />
            </View>
          )}
        </ScrollView>

        {/* Input bar */}
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
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: input.trim() && !loading ? Colors.accent : Colors.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700' }}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
