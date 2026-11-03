import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useChatStore } from '@/hooks/useChatStore';
import { Colors, Hit, Radius, Spacing } from '@/constants/theme';
import { AppText, Button } from '@/components/ui';
import { PaywallModal } from '@/components/PaywallModal';
import { useWorld, useWorldStore } from '@/theme';
import { CoachHeader } from '@/components/insights/CoachHeader';
import { ChatView, type ChatMessage } from '@/components/insights/ChatView';
import { MonthlyAnalysis } from '@/components/insights/MonthlyAnalysis';
import { ImportSection } from '@/components/insights/ImportSection';
import { buildCoachContext } from '@/components/insights/buildCoachContext';
import { STARTER_PROMPTS_BY_TIER } from '@/components/insights/coachPrompts';

type Tab = 'chat' | 'insights';

/** Coach. Hero: the chat. Monthly analysis + import sit behind "Insights". */
export default function CoachTab() {
  const world = useWorld();
  const { user, profile, refreshProfile } = useAuth();
  const { isPro, canAskCoach, aiAsksRemaining, aiAsksResetDate, recordAIAsk } = useSubscription();
  // Coach tier = the rank from the Power Level (cached in the world store).
  const tierKey = useWorldStore(s => s.rankKey);
  const subTier = useWorldStore(s => s.rankSub);
  const { messages, addMessage } = useChatStore();
  const [tab, setTab] = useState<Tab>('chat');
  const [loading, setLoading] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // A lifter who's experienced but hasn't logged yet sits at Mortal — don't
  // greet them like it's their first day.
  const promptTier = tierKey === 'mortal' && ['advanced', 'competitive'].includes(profile?.experience_level ?? '') ? 'ascendant' : tierKey;
  const prompts = STARTER_PROMPTS_BY_TIER[promptTier] ?? STARTER_PROMPTS_BY_TIER.mortal;
  const refill = aiAsksResetDate ? ` · refills ${aiAsksResetDate.toLocaleDateString('en-US', { weekday: 'long' })}` : '';

  const send = async (text: string) => {
    if (!text.trim() || loading || !user) return;
    if (!canAskCoach) { setPaywall(true); return; }
    if (!(await recordAIAsk())) { setPaywall(true); return; }
    addMessage({ role: 'user', content: text.trim(), timestamp: Date.now() });
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      // The prompt skeleton + tier personality live server-side in ai-coach;
      // the client ships only athlete data and a tier key.
      const context = await buildCoachContext(user.id, profile, isPro ? messages : null);
      const { data, error } = await supabase.functions.invoke('ai-coach', {
        body: {
          context, tierKey, subTier,
          messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: text.trim() }],
        },
      });
      if (error) throw error;
      addMessage({ role: 'assistant', content: data?.content?.[0]?.text ?? 'Something went wrong. Try again.', timestamp: Date.now() });
      if (!isPro) refreshProfile();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      addMessage({ role: 'assistant', content: 'Could not reach your coach. Check your connection.', timestamp: Date.now() });
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill from other screens (e.g. Home's weekly-plan task)
  useFocusEffect(useCallback(() => {
    const preFill = (global as any).__coachPreFill;
    if (preFill) {
      (global as any).__coachPreFill = null;
      setTab('chat');
      setTimeout(() => send(preFill), 100);
    }
  }, [user?.id, messages.length]));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <CoachHeader />
          {isPro
            ? <AppText variant="label" color={world.aura}>Pro</AppText>
            : <Button label={aiAsksRemaining > 0 ? `${aiAsksRemaining} left` : 'Go Pro'} variant="tinted" size="sm" onPress={() => setPaywall(true)} />}
        </View>
        <View style={styles.segment}>
          {(['chat', 'insights'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.seg, tab === t && { backgroundColor: world.aura + '1F', borderColor: world.aura }]}
              accessibilityState={{ selected: tab === t }}
            >
              <AppText variant="label" color={tab === t ? world.aura : Colors.textSecondary}>{t === 'chat' ? 'Chat' : 'Insights'}</AppText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab === 'chat' ? (
        <ChatView
          messages={messages as ChatMessage[]}
          loading={loading}
          prompts={prompts}
          asksNote={isPro ? null : `${aiAsksRemaining} of 5 coach questions left this week${refill}`}
          onSend={send}
          scrollRef={scrollRef}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.insights} keyboardShouldPersistTaps="handled">
          <MonthlyAnalysis
            profile={profile}
            isPro={isPro}
            tierKey={tierKey}
            subTier={subTier}
            onRefreshProfile={refreshProfile}
            onPaywall={() => setPaywall(true)}
          />
          <ImportSection userId={user?.id} />
        </ScrollView>
      )}

      <PaywallModal
        visible={paywall}
        onClose={() => setPaywall(false)}
        reason={aiAsksRemaining === 0 ? `You've used your 5 free coach questions this week${refill}. Or go Pro for unlimited.` : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.screenH, gap: Spacing.sm, paddingBottom: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  segment: { flexDirection: 'row', gap: Spacing.sm },
  seg: { flex: 1, minHeight: Hit.min - 4, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  insights: { padding: Spacing.screenH, gap: Spacing.group, paddingBottom: 60 },
});
