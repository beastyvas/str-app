import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText, IconSymbol } from '@/components/ui';
import { Colors, Fonts, Hit, Radius, Spacing, onColor } from '@/constants/theme';
import { CHARACTERS } from '@/constants/cameos';
import { TIER_CHARACTER } from '@/constants/ranks';
import { useWorld, useWorldStore } from '@/theme';

export interface ChatMessage { role: 'user' | 'assistant'; content: string; timestamp: number }

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  prompts: string[];
  asksNote: string | null;
  onSend: (text: string) => void;
  scrollRef: React.RefObject<ScrollView | null>;
}

/** The chat — the Coach tab's hero. */
export function ChatView({ messages, loading, prompts, asksNote, onSend, scrollRef }: Props) {
  const world = useWorld();
  const rankKey = useWorldStore(s => s.rankKey);
  const lead = CHARACTERS[TIER_CHARACTER[rankKey]];
  const [input, setInput] = useState('');
  const send = (t: string) => { if (!t.trim() || loading) return; onSend(t); setInput(''); };
  const avatar = <Image source={lead.portrait} style={[styles.avatar, { borderColor: world.aura }]} contentFit="cover" contentPosition="top" />;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {messages.length === 0 && (
          <View style={styles.intro}>
            <AppText variant="body" style={styles.center}>Ask anything about your training. Your coach reads your logs.</AppText>
            {asksNote && <AppText variant="caption" style={styles.center}>{asksNote}</AppText>}
            <View style={styles.prompts}>
              {prompts.map((p, i) => (
                <TouchableOpacity key={i} onPress={() => send(p)} style={[styles.prompt, { borderLeftColor: world.aura }]} accessibilityRole="button">
                  <AppText variant="body" color={Colors.text}>{p}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        {messages.map((m, i) => (
          <View key={i} style={[styles.msgRow, m.role === 'user' && styles.mine]}>
            {m.role === 'assistant' && avatar}
            <View style={[
              styles.bubble,
              m.role === 'user' ? [styles.userBubble, { backgroundColor: world.aura }] : styles.coachBubble,
            ]}>
              <AppText variant="body" color={m.role === 'user' ? onColor(world.aura) : Colors.text}>{m.content}</AppText>
            </View>
          </View>
        ))}
        {loading && (
          <View style={styles.msgRow}>
            {avatar}
            <View style={[styles.bubble, styles.coachBubble]}><ActivityIndicator color={world.aura} size="small" /></View>
          </View>
        )}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask your coach"
          placeholderTextColor={Colors.textMuted}
          multiline
          style={styles.input}
        />
        <TouchableOpacity
          onPress={() => send(input)}
          disabled={!input.trim() || loading}
          style={[styles.send, { backgroundColor: input.trim() && !loading ? world.aura : Colors.surface2 }]}
          accessibilityLabel="Send"
        >
          <IconSymbol name="chevronUp" size={20} color={input.trim() && !loading ? onColor(world.aura) : Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: Spacing.screenH, gap: Spacing.md },
  intro: { gap: Spacing.md, paddingVertical: Spacing.lg },
  center: { textAlign: 'center' },
  prompts: { gap: Spacing.sm },
  prompt: { backgroundColor: Colors.surface, borderLeftWidth: 3, borderRadius: Radius.sm, padding: Spacing.md, minHeight: Hit.min, justifyContent: 'center' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  mine: { flexDirection: 'row-reverse' },
  avatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, backgroundColor: Colors.surface2 },
  bubble: { maxWidth: '82%', padding: Spacing.md, borderRadius: Radius.lg },
  userBubble: { borderBottomRightRadius: 4 },
  coachBubble: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, paddingHorizontal: Spacing.screenH, paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, backgroundColor: Colors.bg,
  },
  input: {
    flex: 1, minHeight: Hit.min, maxHeight: 120, backgroundColor: Colors.surface2, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 12, color: Colors.text, fontFamily: Fonts.body, fontSize: 15,
  },
  send: { width: Hit.min, height: Hit.min, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
});
