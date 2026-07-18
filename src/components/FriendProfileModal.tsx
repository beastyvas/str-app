import { useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, TierName } from '@/constants/colors';
import { UserBadges } from './UserBadges';
import { supabase } from '@/lib/supabase';
import { getTierForWeight, TIER_LABELS, TIER_ORDER } from '@/constants/strengthStandards';
import { getRankResult, ROMAN } from '@/constants/ranks';
import { useModeration } from '@/hooks/useModeration';
import { useAuth } from '@/hooks/useAuth';
import { toDisplay, fmtVolume as fmtVolumeUnit, unitFromProfile } from '@/lib/units';
import { SESSION_COLORS, classifySessionFromSets as classifySession } from '@/lib/sessionType';

const TIER_COLORS: Record<TierName, string> = {
  beginner: Colors.tiers.beginner, bronze: Colors.tiers.bronze,
  silver: Colors.tiers.silver, gold: Colors.tiers.gold,
  platinum: Colors.tiers.platinum, diamond: Colors.tiers.diamond,
};


function computeSplit(workouts: any[]) {
  if (!workouts || workouts.length === 0) return null;
  const classified = workouts.map(w => ({
    dayOfWeek: new Date(w.started_at).getDay(),
    type: classifySession(w.workout_sets ?? []),
    ts: new Date(w.started_at).getTime(),
  }));
  const recentCount = classified.filter(c => c.ts > Date.now() - 28 * 86400000).length;
  const sessionsPerWeek = Math.round((recentCount / 4) * 10) / 10;

  const dayMap: Record<number, Record<string, number>> = {};
  for (const c of classified) {
    if (!dayMap[c.dayOfWeek]) dayMap[c.dayOfWeek] = {};
    dayMap[c.dayOfWeek][c.type] = (dayMap[c.dayOfWeek][c.type] ?? 0) + 1;
  }
  const typicalWeek: Array<{ type: string; color: string } | null> = Array(7).fill(null);
  for (const [day, counts] of Object.entries(dayMap)) {
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top && top !== 'Other') typicalWeek[Number(day)] = { type: top, color: SESSION_COLORS[top] ?? Colors.textMuted };
  }

  const types = [...new Set(classified.map(c => c.type).filter(t => t !== 'Other'))];
  let splitLabel = 'Custom';
  if (types.includes('Push') && types.includes('Pull') && types.includes('Legs')) splitLabel = 'Push / Pull / Legs';
  else if ((types.includes('Upper') || (types.includes('Push') && types.includes('Pull'))) && types.includes('Legs')) splitLabel = 'Upper / Lower';
  else if (types.includes('Upper') && types.includes('Legs')) splitLabel = 'Upper / Lower';
  else if (types.every(t => t === 'Full Body')) splitLabel = 'Full Body';
  else if (types.length === 1 && types[0]) splitLabel = types[0];

  return { splitLabel, sessionsPerWeek, typicalWeek };
}

interface Props {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
  // Fired the moment a friend request lands as accepted (creator auto-accept)
  // so the parent can show the new friend instantly — no refetch wait.
  onFriended?: (friend: {
    id: string; friendshipId: string; display_name: string;
    avatar_url?: string; bio?: string; bodyweight_lbs?: number;
    is_owner?: boolean; is_og?: boolean; is_pro?: boolean;
  }) => void;
}

export function FriendProfileModal({ visible, userId, onClose, onFriended }: Props) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [prs, setPrs] = useState<any[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [splitData, setSplitData] = useState<ReturnType<typeof computeSplit>>(null);
  const [rankResult, setRankTier] = useState<ReturnType<typeof getRankResult> | null>(null);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'friends'>('none');
  const [addingFriend, setAddingFriend] = useState(false);
  const [showH2H, setShowH2H] = useState(false);
  const [photosByWorkout, setPhotosByWorkout] = useState<Record<string, string>>({});

  const { user: me, profile: myProfile } = useAuth();
  // Friend's numbers shown in MY preferred unit (the viewer's)
  const unit = unitFromProfile(myProfile?.unit_pref);
  const { reportContent, blockUser } = useModeration();
  const [myRank, setMyRank] = useState<ReturnType<typeof getRankResult> | null>(null);

  // Safety menu — report objectionable content or block an abusive user.
  const openSafetyMenu = () => {
    if (!userId || userId === me?.id) return;
    const name = profile?.display_name ?? 'this user';
    Alert.alert(name, 'Keep STR safe', [
      {
        text: 'Report user',
        onPress: () => {
          Alert.alert(
            'Report user',
            `Report ${name} for objectionable content or abusive behavior? Our team reviews reports within 24 hours.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Report',
                style: 'destructive',
                onPress: async () => {
                  const ok = await reportContent({ reportedUserId: userId, contentType: 'profile', contentId: userId });
                  Alert.alert(ok ? 'Reported' : 'Error', ok
                    ? 'Thanks — our team will review this within 24 hours.'
                    : 'Could not file the report. Please try again.');
                },
              },
            ],
          );
        },
      },
      {
        text: 'Block user',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Block user',
            `Block ${name}? You won't see their posts or profile, and they'll be removed from your feed.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Block',
                style: 'destructive',
                onPress: async () => {
                  const ok = await blockUser(userId);
                  if (ok) { Alert.alert('Blocked', `${name} has been blocked.`); onClose(); }
                  else Alert.alert('Error', 'Could not block this user. Please try again.');
                },
              },
            ],
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    Promise.all([
      supabase.from('public_profiles').select('*').eq('id', userId!).single(),
      supabase
        .from('personal_records')
        .select('weight, reps, achieved_at, exercises(name, muscle_group)')
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false }),
      supabase
        .from('workouts')
        .select('id, name, started_at, ended_at, notes, workout_sets(weight, reps, exercises(name, muscle_group))')
        .eq('user_id', userId)
        .not('ended_at', 'is', null)
        .or('is_imported.is.null,is_imported.eq.false')
        .order('started_at', { ascending: false })
        .limit(20),
      supabase
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('ended_at', 'is', null),
    ]).then(async ([{ data: prof }, { data: prData }, { data: workouts }, { count }]) => {
      setProfile(prof);
      setPrs(prData ?? []);
      setRecentWorkouts(workouts ?? []);
      setWorkoutCount(count ?? 0);

      // Workout photos make the recent list read like their feed posts
      const workoutIds = (workouts ?? []).map((w: any) => w.id);
      if (workoutIds.length > 0) {
        supabase.from('workout_photos')
          .select('workout_id, photo_url')
          .in('workout_id', workoutIds)
          .then(({ data: photoRows }) => {
            const map: Record<string, string> = {};
            (photoRows ?? []).forEach((p: any) => { map[p.workout_id] = p.photo_url; });
            setPhotosByWorkout(map);
          });
      } else {
        setPhotosByWorkout({});
      }

      // Prefer manually configured split; fall back to auto-detection
      if (prof?.split_type || prof?.split_schedule) {
        const storedWeek: Array<{ type: string; color: string } | null> = Array(7).fill(null);
        Object.entries((prof.split_schedule ?? {}) as Record<string, string>).forEach(([day, type]) => {
          storedWeek[Number(day)] = { type, color: SESSION_COLORS[type] ?? Colors.textMuted };
        });
        setSplitData({
          splitLabel: prof.split_type ?? 'Custom',
          sessionsPerWeek: Object.keys(prof.split_schedule ?? {}).length,
          typicalWeek: storedWeek,
        });
      } else {
        setSplitData(computeSplit(workouts ?? []));
      }

      const sbdPrs = (prData ?? [])
        .filter((p: any) => ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts'].includes(p.exercises?.name))
        .map((p: any) => ({ exerciseName: p.exercises?.name, weight: p.weight, reps: p.reps }));
      setRankTier(getRankResult(sbdPrs, prof?.bodyweight_lbs ?? 185));

      const { data: { user: me } } = await supabase.auth.getUser();
      if (me && userId) {
        const { data: friendship } = await supabase
          .from('friendships')
          .select('status')
          .or(`requester_id.eq.${me.id},addressee_id.eq.${me.id}`)
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
          .maybeSingle();
        if (friendship?.status === 'accepted') setFriendStatus('friends');
        else if (friendship?.status === 'pending') setFriendStatus('pending');
        else setFriendStatus('none');

        // The viewer's own SBD rank, for the head-to-head comparison strip
        if (me.id !== userId) {
          const { data: myPrData } = await supabase
            .from('personal_records')
            .select('weight, reps, exercises(name)')
            .eq('user_id', me.id);
          const mySbd = (myPrData ?? [])
            .filter((p: any) => ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts'].includes(p.exercises?.name))
            .map((p: any) => ({ exerciseName: p.exercises?.name, weight: p.weight, reps: p.reps }));
          setMyRank(getRankResult(mySbd, myProfile?.bodyweight_lbs ?? 185));
        }
      }

      setLoading(false);
    });
  }, [visible, userId]);

  const initials = (name: string) => name?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) ?? '?';

  const sendFriendRequest = async () => {
    if (!userId) return;
    setAddingFriend(true);
    try {
      const { data: { user: me } } = await supabase.auth.getUser();
      if (!me) return;
      const { data: row, error } = await supabase.from('friendships').insert({
        requester_id: me.id, addressee_id: userId,
      }).select('id, status').single();
      if (error) throw error;
      // The creator auto-accepts server-side (migration 012) — reflect it
      // instantly so the first friend-add feels like it just... worked.
      if (row?.status === 'accepted') {
        setFriendStatus('friends');
        if (profile) {
          onFriended?.({
            id: userId,
            friendshipId: row.id,
            display_name: profile.display_name ?? 'Friend',
            avatar_url: profile.avatar_url,
            bio: profile.bio,
            bodyweight_lbs: profile.bodyweight_lbs,
            is_owner: profile.is_owner,
            is_og: profile.is_og,
            is_pro: profile.is_pro,
          });
        }
      } else {
        setFriendStatus('pending');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAddingFriend(false);
    }
  };

  const tierColor = rankResult?.tier.color ?? Colors.accent;

  const isSelf = !!me?.id && me.id === userId;
  // PRs are gated behind an accepted friendship (except the creator, whose PRs
  // are public). If we're not friends and got no PRs back, they're hidden.
  const prsHidden = !isSelf && friendStatus !== 'friends' && !profile?.is_owner && prs.length === 0;

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

  const formatVol = (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);

  // Compute muscle group tiers from PRs
  const muscleGroupTiers = (() => {
    const bw = profile?.bodyweight_lbs ?? 185;
    const groupMap: Record<string, { tier: TierName; bestLift: string; weight: number }> = {};
    for (const pr of prs) {
      const name = pr.exercises?.name ?? '';
      const mg = pr.exercises?.muscle_group ?? 'Overall';
      // Only ranked lifts (the SBD lifts) return a non-beginner tier.
      const tier = getTierForWeight(name, pr.weight, bw);
      if (tier === 'beginner') continue;
      if (!groupMap[mg] || TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(groupMap[mg].tier)) {
        groupMap[mg] = { tier, bestLift: name, weight: pr.weight };
      }
    }
    return Object.entries(groupMap)
      .sort((a, b) => TIER_ORDER.indexOf(b[1].tier) - TIER_ORDER.indexOf(a[1].tier))
      .map(([group, data]) => ({ group, ...data }));
  })();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: 20, paddingVertical: 12,
        }}>
          {!loading && friendStatus === 'none' && (
            <TouchableOpacity
              onPress={sendFriendRequest}
              disabled={addingFriend}
              style={{
                backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9,
                shadowColor: Colors.accent, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
              }}
            >
              {addingFriend
                ? <ActivityIndicator color={Colors.text} size="small" />
                : <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 14 }}>+ Add Friend</Text>}
            </TouchableOpacity>
          )}
          {!loading && friendStatus === 'pending' && (
            <View style={{ backgroundColor: Colors.surface2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 }}>
              <Text style={{ color: Colors.textMuted, fontWeight: '600', fontSize: 13 }}>Request Sent</Text>
            </View>
          )}
          {!loading && friendStatus === 'friends' && (
            <View style={{ backgroundColor: Colors.success + '20', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.success + '40' }}>
              <Text style={{ color: Colors.success, fontWeight: '700', fontSize: 13 }}>Friends ✓</Text>
            </View>
          )}
          {loading && <View />}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* Safety — report / block (Guideline 1.2) */}
            {!loading && userId && userId !== me?.id && (
              <TouchableOpacity onPress={openSafetyMenu} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: Colors.textMuted, fontSize: 18, lineHeight: 20, textAlign: 'center' }}>⋯</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: Colors.textMuted, fontSize: 18, lineHeight: 20, textAlign: 'center' }}>×</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 60 }} />
        ) : profile ? (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}>

            {/* ── PRs LOCKED (non-friend) ───────────────────────────────── */}
            {prsHidden && (
              <View style={{
                backgroundColor: Colors.surface, borderRadius: 16, padding: 18,
                borderWidth: 1, borderColor: Colors.accent + '35', alignItems: 'center', gap: 6,
              }}>
                <Text style={{ fontSize: 22 }}>🔒</Text>
                <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', textAlign: 'center' }}>
                  Add friend to see their PRs
                </Text>
                <Text style={{ color: Colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 17 }}>
                  Their lifts, rank, and head-to-head unlock once you're friends.
                </Text>
              </View>
            )}

            {/* ── HERO ──────────────────────────────────────────────────── */}
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 92, height: 92, borderRadius: 46,
                backgroundColor: tierColor + '20',
                borderWidth: 3, borderColor: tierColor + '70',
                alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
                shadowColor: tierColor, shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
              }}>
                {profile.avatar_url
                  ? <Image source={{ uri: profile.avatar_url }} style={{ width: 92, height: 92 }} cachePolicy="disk" transition={150} />
                  : <Text style={{ color: tierColor, fontWeight: '800', fontSize: 32 }}>{initials(profile.display_name ?? '')}</Text>}
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={{ color: Colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
                  {profile.display_name}
                </Text>
                {profile.username && (
                  <Text style={{ color: Colors.accent, fontSize: 13, fontWeight: '700' }}>@{profile.username}</Text>
                )}
                <UserBadges isOwner={profile.is_owner} isOg={profile.is_og} isPro={profile.is_pro} size="sm" />
                {profile.bio && (
                  <Text style={{ color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 6, paddingHorizontal: 8 }}>
                    {profile.bio}
                  </Text>
                )}
              </View>
            </View>

            {/* ── STATS ROW ─────────────────────────────────────────────── */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { label: 'Workouts', value: String(workoutCount) },
                { label: 'PRs', value: String(prs.length) },
                { label: 'Bodyweight', value: profile.bodyweight_lbs ? `${profile.bodyweight_lbs} lbs` : '—' },
              ].map((s, i) => (
                <View key={i} style={{
                  flex: 1, backgroundColor: Colors.surface, borderRadius: 14,
                  padding: 12, alignItems: 'center',
                  borderWidth: 1, borderColor: Colors.border,
                }}>
                  <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.5 }}>{s.value}</Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 9, marginTop: 3, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: '600' }}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* ── RANK CARD ─────────────────────────────────────────────── */}
            {!prsHidden && rankResult && (
              <View style={{
                backgroundColor: tierColor + '10',
                borderRadius: 16, padding: 18,
                borderWidth: 1.5, borderColor: tierColor + '45',
                alignItems: 'center', gap: 8,
                shadowColor: tierColor, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
              }}>
                <View style={{
                  backgroundColor: tierColor + '22', borderRadius: 10,
                  paddingHorizontal: 16, paddingVertical: 6,
                  borderWidth: 1, borderColor: tierColor + '50',
                }}>
                  <Text style={{
                    color: tierColor, fontWeight: '800', fontSize: 14,
                    letterSpacing: 2.5, textTransform: 'uppercase',
                    textShadowColor: tierColor, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6,
                  }}>
                    {rankResult.tier.label} {ROMAN[rankResult.subTier]}
                  </Text>
                </View>
                <Text style={{ color: Colors.textSecondary, fontSize: 13, fontStyle: 'italic', textAlign: 'center', lineHeight: 19 }}>
                  "{rankResult.tier.tagline}"
                </Text>
                {rankResult.avgScore > 0 && (
                  <Text style={{ color: tierColor + 'AA', fontSize: 11, fontWeight: '700' }}>
                    {rankResult.avgScore.toFixed(1)} / 5.0
                  </Text>
                )}
              </View>
            )}

            {/* ── HEAD-TO-HEAD (collapsed dropdown — expands on tap) ─────── */}
            {!prsHidden && myRank && rankResult && me?.id !== userId && (() => {
              const them = profile?.display_name?.split(' ')[0] || 'Them';
              const liftWeight = (r: typeof myRank, key: string) =>
                r?.lifts.find(l => l.label === key)?.weight ?? 0;
              const rows: { label: string; mine: string; theirs: string; mineWins: boolean | null }[] = [
                {
                  label: 'Rank',
                  mine: `${myRank.tier.label} ${ROMAN[myRank.subTier]}`,
                  theirs: `${rankResult.tier.label} ${ROMAN[rankResult.subTier]}`,
                  mineWins: myRank.avgScore === rankResult.avgScore ? null : myRank.avgScore > rankResult.avgScore,
                },
                ...(['SQ', 'BP', 'DL'] as const).map(k => {
                  const mine = liftWeight(myRank, k);
                  const theirs = liftWeight(rankResult, k);
                  return {
                    label: k === 'SQ' ? 'Squat' : k === 'BP' ? 'Bench' : 'Deadlift',
                    mine: mine > 0 ? `${toDisplay(mine, unit)}` : '—',
                    theirs: theirs > 0 ? `${toDisplay(theirs, unit)}` : '—',
                    mineWins: mine === theirs ? null : mine > theirs,
                  };
                }),
              ];
              return (
                <View style={{
                  backgroundColor: Colors.surface, borderRadius: 14,
                  shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 }, elevation: 3,
                  overflow: 'hidden',
                }}>
                  <TouchableOpacity
                    onPress={() => setShowH2H(v => !v)}
                    activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}
                  >
                    <Text style={{ fontSize: 14 }}>⚔️</Text>
                    <Text style={{ flex: 1, color: Colors.text, fontSize: 13, fontWeight: '700' }}>
                      Head to Head — you vs {them}
                    </Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 11 }}>{showH2H ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {showH2H && (
                    <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                        <View style={{ flex: 1.3 }} />
                        <Text style={{ flex: 1, textAlign: 'center', color: Colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>YOU</Text>
                        <Text style={{ flex: 1, textAlign: 'center', color: Colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }} numberOfLines={1}>
                          {them.toUpperCase()}
                        </Text>
                      </View>
                      {rows.map((row, i) => (
                        <View key={i} style={{
                          flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
                          borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Colors.border,
                        }}>
                          <Text style={{ flex: 1.3, color: Colors.textMuted, fontSize: 12 }}>{row.label}</Text>
                          <Text style={{
                            flex: 1, textAlign: 'center', fontSize: 13, fontVariant: ['tabular-nums'],
                            fontWeight: row.mineWins === true ? '800' : '600',
                            color: row.mineWins === true ? Colors.accent : Colors.textSecondary,
                          }}>
                            {row.mine}
                          </Text>
                          <Text style={{
                            flex: 1, textAlign: 'center', fontSize: 13, fontVariant: ['tabular-nums'],
                            fontWeight: row.mineWins === false ? '800' : '600',
                            color: row.mineWins === false ? tierColor : Colors.textSecondary,
                          }}>
                            {row.theirs}
                          </Text>
                        </View>
                      ))}
                      <Text style={{ color: Colors.textMuted, fontSize: 9, marginTop: 6, textAlign: 'center' }}>
                        Lifts in {unit} · bold = stronger
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* ── SBD ───────────────────────────────────────────────────── */}
            {rankResult && rankResult.lifts.some(l => l.weight > 0) && (
              <View style={{ backgroundColor: Colors.surface, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3, gap: 10 }}>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>SBD Strength</Text>
                {rankResult.lifts.map((lift, i) => {
                  const hasData = lift.weight > 0;
                  return (
                    <View key={i}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '800', width: 24 }}>{lift.label}</Text>
                          {hasData && <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>{toDisplay(lift.weight, unit)} {unit}</Text>}
                        </View>
                        {hasData ? (
                          <View style={{ backgroundColor: TIER_COLORS[lift.tier] + '20', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 }}>
                            <Text style={{ color: TIER_COLORS[lift.tier], fontSize: 10, fontWeight: '800' }}>{TIER_LABELS[lift.tier].toUpperCase()}</Text>
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

            {/* ── MUSCLE GROUP TIERS ────────────────────────────────────── */}
            {muscleGroupTiers.length > 0 && (
              <View style={{ backgroundColor: Colors.surface, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Body Part Ranks</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {muscleGroupTiers.map((mg, i) => {
                    const tc = TIER_COLORS[mg.tier];
                    return (
                      <View key={i} style={{
                        width: '47%', backgroundColor: tc + '10', borderRadius: 12, padding: 12,
                        borderWidth: 1, borderColor: tc + '40', gap: 4,
                      }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: Colors.textSecondary, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>{mg.group}</Text>
                          <View style={{ backgroundColor: tc + '25', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                            <Text style={{ color: tc, fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>{TIER_LABELS[mg.tier].toUpperCase()}</Text>
                          </View>
                        </View>
                        <Text style={{ color: Colors.textMuted, fontSize: 10 }} numberOfLines={1}>{mg.bestLift}</Text>
                        <Text style={{ color: tc, fontSize: 13, fontWeight: '800' }}>{toDisplay(mg.weight, unit)} {unit}</Text>
                        <View style={{ height: 3, backgroundColor: Colors.surface2, borderRadius: 2, marginTop: 2 }}>
                          <View style={{ height: '100%', width: `${(TIER_ORDER.indexOf(mg.tier) / 5) * 100}%`, backgroundColor: tc, borderRadius: 2 }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── TRAINING SPLIT ────────────────────────────────────────── */}
            {splitData && (
              <View style={{ backgroundColor: Colors.surface, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>Training Split</Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '700' }}>
                    {splitData.sessionsPerWeek}x / week
                  </Text>
                </View>
                <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5, marginBottom: 14 }}>
                  {splitData.splitLabel}
                </Text>
                {/* Typical week grid — Sun=0 … Sat=6, display Mon–Sun */}
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {[1, 2, 3, 4, 5, 6, 0].map((dayIdx, col) => {
                    const session = splitData.typicalWeek[dayIdx];
                    const dayLabel = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dayIdx];
                    return (
                      <View key={col} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
                        <View style={{
                          width: '100%', aspectRatio: 1, borderRadius: 8,
                          backgroundColor: session ? session.color + '22' : Colors.surface2,
                          borderWidth: 1, borderColor: session ? session.color + '55' : Colors.border,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          {session && (
                            <Text style={{ color: session.color, fontSize: 7, fontWeight: '800', letterSpacing: 0.3, textAlign: 'center' }}>
                              {session.type === 'Full Body' ? 'FB' : session.type === 'Upper' ? 'UP' : session.type === 'Lower' ? 'LO' : session.type.slice(0, 2).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <Text style={{ color: session ? Colors.textSecondary : Colors.textMuted, fontSize: 8, fontWeight: session ? '700' : '400' }}>
                          {dayLabel}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {/* Legend */}
                {(() => {
                  const seen = [...new Set(splitData.typicalWeek.filter(Boolean).map(s => s!.type))];
                  return seen.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                      {seen.map((type, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: SESSION_COLORS[type] ?? Colors.textMuted }} />
                          <Text style={{ color: Colors.textMuted, fontSize: 10, fontWeight: '600' }}>{type}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null;
                })()}
              </View>
            )}

            {/* ── RECENT SESSIONS ───────────────────────────────────────── */}
            {recentWorkouts.length > 0 && (
              <View style={{ backgroundColor: Colors.surface, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Recent Posts</Text>
                {recentWorkouts.map((w: any, i: number) => {
                  const sets = w.workout_sets ?? [];
                  const vol = sets.reduce((s: number, x: any) => s + x.weight * x.reps, 0);
                  const exNames = [...new Set(sets.map((s: any) => s.exercises?.name).filter(Boolean))] as string[];
                  return (
                    <View key={i} style={{
                      paddingVertical: 12,
                      borderBottomWidth: i < recentWorkouts.length - 1 ? 1 : 0,
                      borderBottomColor: Colors.border,
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>{w.name}</Text>
                        <Text style={{ color: Colors.textMuted, fontSize: 11 }}>{timeAgo(w.started_at)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                        {[
                          `${sets.length} sets`,
                          fmtVolumeUnit(vol, unit),
                          formatDuration(w.started_at, w.ended_at),
                        ].map((chip, ci) => (
                          <View key={ci} style={{ backgroundColor: Colors.surface2, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border }}>
                            <Text style={{ color: Colors.textMuted, fontSize: 10, fontWeight: '600' }}>{chip}</Text>
                          </View>
                        ))}
                      </View>
                      {exNames.length > 0 && (
                        <Text style={{ color: Colors.textMuted, fontSize: 11, lineHeight: 17 }} numberOfLines={2}>
                          {exNames.join(' · ')}
                        </Text>
                      )}
                      {w.notes ? (
                        <Text style={{ color: Colors.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: 6 }} numberOfLines={2}>
                          "{w.notes}"
                        </Text>
                      ) : null}
                      {photosByWorkout[w.id] && (
                        <Image
                          source={{ uri: photosByWorkout[w.id] }}
                          style={{ width: '100%', height: 170, borderRadius: 12, marginTop: 8 }}
                          contentFit="cover"
                          cachePolicy="disk"
                          transition={150}
                        />
                      )}
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
