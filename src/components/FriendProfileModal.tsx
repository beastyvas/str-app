import { useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, TierName } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { getTierForWeight, TIER_LABELS, TIER_ORDER } from '@/constants/strengthStandards';
import { getAnimeTierResult } from '@/constants/animeTiers';

const TIER_COLORS: Record<TierName, string> = {
  beginner: Colors.tiers.beginner, bronze: Colors.tiers.bronze,
  silver: Colors.tiers.silver, gold: Colors.tiers.gold,
  platinum: Colors.tiers.platinum, diamond: Colors.tiers.diamond,
};

interface Props {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
}

export function FriendProfileModal({ visible, userId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [prs, setPrs] = useState<any[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [animeTier, setAnimeTier] = useState<ReturnType<typeof getAnimeTierResult> | null>(null);

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      supabase
        .from('personal_records')
        .select('weight, reps, achieved_at, exercises(name, muscle_group)')
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false }),
      supabase
        .from('workouts')
        .select('id, name, started_at, ended_at, workout_sets(weight, reps, exercises(name))')
        .eq('user_id', userId)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(3),
    ]).then(([{ data: prof }, { data: prData }, { data: workouts }]) => {
      setProfile(prof);
      setPrs(prData ?? []);
      setRecentWorkouts(workouts ?? []);

      const sbdPrs = (prData ?? [])
        .filter((p: any) => ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts'].includes(p.exercises?.name))
        .map((p: any) => ({ exerciseName: p.exercises?.name, weight: p.weight, reps: p.reps }));
      setAnimeTier(getAnimeTierResult(sbdPrs, prof?.bodyweight_lbs ?? 185));
      setLoading(false);
    });
  }, [visible, userId]);

  const initials = (name: string) => name?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) ?? '?';
  const tierColor = animeTier?.animeTier.color ?? Colors.accent;

  const formatDuration = (start: string, end: string) => {
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const timeAgo = (iso: string) => {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (d === 0) return 'Today';
    if (d === 1) return 'Yesterday';
    return `${d}d ago`;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', justifyContent: 'flex-end',
          paddingHorizontal: 20, paddingVertical: 12,
        }}>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: Colors.textMuted, fontSize: 22 }}>×</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 60 }} />
        ) : profile ? (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {/* Avatar + name */}
            <View style={{ alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: tierColor + '20',
                borderWidth: 2.5, borderColor: tierColor + '80',
                alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {profile.avatar_url
                  ? <Image source={{ uri: profile.avatar_url }} style={{ width: 80, height: 80 }} />
                  : <Text style={{ color: tierColor, fontWeight: '900', fontSize: 28 }}>{initials(profile.display_name ?? '')}</Text>
                }
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '900' }}>
                  {profile.display_name}
                </Text>
                {profile.username && (
                  <Text style={{ color: Colors.accent, fontSize: 14, fontWeight: '700' }}>@{profile.username}</Text>
                )}
                {profile.bio && (
                  <Text style={{ color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 4 }}>
                    {profile.bio}
                  </Text>
                )}
              </View>
            </View>

            {/* Anime tier */}
            {animeTier && (
              <View style={{
                backgroundColor: tierColor + '12',
                borderRadius: 14, padding: 16,
                borderWidth: 1.5, borderColor: tierColor + '50',
                alignItems: 'center', gap: 6,
              }}>
                <View style={{
                  backgroundColor: tierColor + '25',
                  borderRadius: 8, paddingHorizontal: 14, paddingVertical: 5,
                }}>
                  <Text style={{ color: tierColor, fontWeight: '900', fontSize: 13, letterSpacing: 2 }}>
                    {animeTier.animeTier.label}
                  </Text>
                </View>
                <Text style={{ color: Colors.textSecondary, fontSize: 12, fontStyle: 'italic', textAlign: 'center' }}>
                  "{animeTier.animeTier.tagline}"
                </Text>
              </View>
            )}

            {/* SBD PRs */}
            {animeTier && animeTier.lifts.some(l => l.weight > 0) && (
              <View style={{
                backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
                borderWidth: 1, borderColor: Colors.border, gap: 10,
              }}>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
                  SBD
                </Text>
                {animeTier.lifts.map((lift, i) => {
                  const hasData = lift.weight > 0;
                  return (
                    <View key={i}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '800', width: 24 }}>{lift.label}</Text>
                          {hasData && <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>{lift.weight} lbs</Text>}
                        </View>
                        {hasData ? (
                          <View style={{ backgroundColor: TIER_COLORS[lift.tier] + '20', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 }}>
                            <Text style={{ color: TIER_COLORS[lift.tier], fontSize: 10, fontWeight: '800' }}>
                              {TIER_LABELS[lift.tier].toUpperCase()}
                            </Text>
                          </View>
                        ) : <Text style={{ color: Colors.textMuted, fontSize: 11 }}>—</Text>}
                      </View>
                      <View style={{ height: 4, backgroundColor: Colors.surface2, borderRadius: 2 }}>
                        <View style={{
                          height: '100%', borderRadius: 2,
                          width: hasData ? `${(lift.tierScore / 5) * 100}%` : '2%',
                          backgroundColor: hasData ? TIER_COLORS[lift.tier] : Colors.border,
                        }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* All PRs */}
            {prs.length > 0 && (
              <View style={{
                backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
                borderWidth: 1, borderColor: Colors.border,
              }}>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
                  Personal Records
                </Text>
                {prs.slice(0, 8).map((pr: any, i: number) => {
                  const tier = getTierForWeight(pr.exercises?.name ?? '', pr.weight, profile.bodyweight_lbs ?? 185);
                  return (
                    <View key={i} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                      paddingVertical: 8,
                      borderBottomWidth: i < Math.min(prs.length, 8) - 1 ? 1 : 0,
                      borderBottomColor: Colors.border,
                    }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TIER_COLORS[tier], flexShrink: 0 }} />
                      <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                        {pr.exercises?.name}
                      </Text>
                      <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
                        {pr.weight} × {pr.reps}
                      </Text>
                      <View style={{ backgroundColor: TIER_COLORS[tier] + '18', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: TIER_COLORS[tier], fontSize: 9, fontWeight: '800' }}>{TIER_LABELS[tier].toUpperCase()}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Recent workouts */}
            {recentWorkouts.length > 0 && (
              <View style={{
                backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
                borderWidth: 1, borderColor: Colors.border,
              }}>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
                  Recent Sessions
                </Text>
                {recentWorkouts.map((w: any, i: number) => {
                  const sets = w.workout_sets ?? [];
                  const vol = sets.reduce((s: number, x: any) => s + x.weight * x.reps, 0);
                  return (
                    <View key={i} style={{
                      paddingVertical: 10,
                      borderBottomWidth: i < recentWorkouts.length - 1 ? 1 : 0,
                      borderBottomColor: Colors.border,
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                        <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{w.name}</Text>
                        <Text style={{ color: Colors.textMuted, fontSize: 11 }}>{timeAgo(w.started_at)}</Text>
                      </View>
                      <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                        {sets.length} sets · {vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : vol} lbs · {formatDuration(w.started_at, w.ended_at)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: Colors.textMuted }}>Could not load profile</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
