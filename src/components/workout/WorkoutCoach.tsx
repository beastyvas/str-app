import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';

interface Set {
  weight: number;
  reps: number;
  rpe?: number;
  note?: string;
  exerciseName: string;
}

interface Props {
  lastSet: Set | null;
  allSetsThisExercise: Set[];
  isPro: boolean;
  trainingStyle?: string | null; // 'powerlifting' | 'bodybuilding' | 'hybrid' etc.
  rankTierKey?: string; // 'godhand' etc. — determines coach persona
  onDismiss: () => void;
}

// ── Rules-based nudges (free + pro) ──────────────────────────────────────────
function getRulesNudge(set: Set, history: Set[]): string | null {
  const { rpe, weight, reps, note, exerciseName } = set;

  if (rpe && rpe >= 10) return `RPE 10 on ${exerciseName}. That's your limit — stop here or drop weight significantly next set.`;
  if (rpe && rpe === 9) return `RPE 9. Near max. Take full rest and consider dropping 5-10 lbs next set.`;
  if (rpe && rpe === 8) return `Solid RPE 8. Stay here or go up slightly if you feel fresh.`;

  if (note && /form|broke|failed|miss/i.test(note)) return `Form flag noted. Don't push through — fix the issue before adding weight.`;

  // Stall detection — same weight × reps 3+ sets in a row
  if (history.length >= 2) {
    const last3 = [...history.slice(-2), set];
    const allSame = last3.every(s => s.weight === weight && s.reps === reps);
    if (allSame) return `3 sets at ${weight} × ${reps}. You've stalled here — consider a small deload or technique adjustment.`;
  }

  // PR detection (weight higher than any previous set this exercise)
  const prevMax = history.reduce((m, s) => Math.max(m, s.weight), 0);
  if (weight > prevMax && history.length > 0) return `New top set on ${exerciseName}. Lock in that form before going heavier.`;

  return null;
}

// ── AI nudge (Pro — calls Claude via Supabase edge function, key never leaves the server) ──
async function getAINudge(
  set: Set,
  history: Set[],
  trainingStyle: string,
  tierKey: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('coach-nudge', {
      body: { lastSet: set, history, trainingStyle, rankTierKey: tierKey },
    });
    if (error) return null;
    return data?.text || null;
  } catch {
    return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function WorkoutCoach({ lastSet, allSetsThisExercise, isPro, enabled = true, trainingStyle, rankTierKey, onDismiss }: Props) {
  const { top: safeTop } = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(80)).current;
  const processedSet = useRef<string | null>(null);

  useEffect(() => {
    if (!lastSet || !enabled) return;
    const setKey = `${lastSet.exerciseName}-${lastSet.weight}-${lastSet.reps}-${lastSet.rpe}`;
    if (processedSet.current === setKey) return;
    processedSet.current = setKey;

    const history = allSetsThisExercise.slice(0, -1); // exclude the set just logged

    const rulesNudge = getRulesNudge(lastSet, history);

    if (rulesNudge) {
      show(rulesNudge);
      // If Pro, also try AI for richer response
      if (isPro) {
        getAINudge(lastSet, history, trainingStyle ?? 'hybrid', rankTierKey ?? 'mortal')
          .then(aiText => { if (aiText) show(aiText); });
      }
    } else if (isPro) {
      // For pro: only AI-trigger on notable events (RPE 7+, or every 3rd set)
      const notable = (lastSet.rpe && lastSet.rpe >= 7) || allSetsThisExercise.length % 3 === 0;
      if (notable) {
        setLoading(true);
        getAINudge(lastSet, history, trainingStyle ?? 'hybrid', rankTierKey ?? 'mortal')
          .then(aiText => {
            setLoading(false);
            if (aiText) show(aiText);
          });
      }
    }
  }, [lastSet]);

  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (text: string) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setMessage(text);
    slideAnim.setValue(-80);
    Animated.spring(slideAnim, { toValue: 0, tension: 120, friction: 14, useNativeDriver: true }).start();
    dismissTimer.current = setTimeout(() => dismiss(), 4000);
  };

  const dismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.timing(slideAnim, { toValue: -80, duration: 200, useNativeDriver: true }).start(() => {
      setMessage(null);
      onDismiss();
    });
  };

  if (!message && !loading) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute', top: safeTop + 8, left: 16, right: 16,
        transform: [{ translateY: slideAnim }],
        zIndex: 100,
      }}
    >
      {/* Compact banner — slides down from top, out of way of exercise controls */}
      <View style={{
        backgroundColor: Colors.surface + 'F0', // slightly transparent
        borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
        borderWidth: 1, borderColor: Colors.accent + '35',
        flexDirection: 'row', alignItems: 'center', gap: 8,
        shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 }, elevation: 6,
      }}>
        <Text style={{ fontSize: 13 }}>⚡</Text>
        <Text style={{ color: Colors.text, fontSize: 12, flex: 1, lineHeight: 17 }} numberOfLines={2}>
          {loading ? 'Coach...' : message}
        </Text>
        {isPro && !loading && (
          <Text style={{ color: Colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }}>PRO</Text>
        )}
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={{ color: Colors.textMuted, fontSize: 15 }}>×</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
