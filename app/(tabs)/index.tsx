import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

interface FriendPR {
  display_name: string;
  exercise_name: string;
  weight: number;
  reps: number;
  achieved_at: string;
  unit_pref: 'lbs' | 'kg';
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [prs, setPrs] = useState<FriendPR[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFriendPRs();
  }, []);

  const fetchFriendPRs = async () => {
    try {
      // Get friends' recent PRs via join
      const { data } = await supabase
        .from('personal_records')
        .select(`
          weight, reps, achieved_at,
          exercises ( name ),
          users!inner ( display_name, unit_pref )
        `)
        .neq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .order('achieved_at', { ascending: false })
        .limit(10);

      if (data) {
        setPrs(data.map((pr: any) => ({
          display_name: pr.users.display_name,
          exercise_name: pr.exercises.name,
          weight: pr.weight,
          reps: pr.reps,
          achieved_at: pr.achieved_at,
          unit_pref: pr.users.unit_pref,
        })));
      }
    } catch (e) {
      // silence
    } finally {
      setLoading(false);
    }
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    if (d < 7) return `${d}d ago`;
    return `${d}d ago`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ marginBottom: 28 }}>
          <Text style={{ color: Colors.textMuted, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
            Good {getTimeOfDay()}
          </Text>
          <Text style={{ color: Colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -1, marginTop: 4 }}>
            {profile?.display_name?.split(' ')[0] ?? 'Athlete'}
          </Text>
        </View>

        {/* Start Workout CTA */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/workout')}
          style={{
            backgroundColor: Colors.accent,
            borderRadius: 16,
            padding: 24,
            marginBottom: 28,
          }}
        >
          <Text style={{ color: Colors.text, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
            Ready to train?
          </Text>
          <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>
            Start Workout →
          </Text>
        </TouchableOpacity>

        {/* AI Coach Card */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/insights')}
          style={{
            backgroundColor: Colors.surface,
            borderRadius: 14,
            padding: 16,
            marginBottom: 28,
            borderWidth: 1,
            borderColor: Colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: Colors.accentDim,
            borderWidth: 1,
            borderColor: Colors.accent + '40',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 18 }}>⚡</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>AI Coach</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 1 }}>
              Ask about your training, volume, recovery
            </Text>
          </View>
          <Text style={{ color: Colors.textMuted, fontSize: 18 }}>›</Text>
        </TouchableOpacity>

        {/* Activity Strip — friends' PRs */}
        <View>
          <Text style={{
            color: Colors.textMuted, fontSize: 11,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
          }}>
            Friend Activity
          </Text>

          {loading ? (
            <ActivityIndicator color={Colors.textMuted} style={{ marginTop: 20 }} />
          ) : prs.length === 0 ? (
            <View style={{
              backgroundColor: Colors.surface,
              borderRadius: 12,
              padding: 20,
              borderWidth: 1,
              borderColor: Colors.border,
            }}>
              <Text style={{ color: Colors.textMuted, fontSize: 13 }}>
                Add friends to see their PRs here.
              </Text>
            </View>
          ) : (
            prs.map((pr, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: Colors.surface,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 2 }}>
                    {pr.display_name}
                  </Text>
                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>
                    🏆 {pr.exercise_name} PR — {pr.weight}{pr.unit_pref}
                  </Text>
                  {pr.reps > 1 && (
                    <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                      {pr.reps} reps
                    </Text>
                  )}
                </View>
                <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                  {timeAgo(pr.achieved_at)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
