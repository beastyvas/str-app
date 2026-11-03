import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getRankResult } from '@/constants/ranks';
import { useModeration } from '@/hooks/useModeration';
import { classifySessionFromSets as classifySession } from '@/lib/sessionType';
import { computePowerReading } from '@/lib/powerLevel';

export type FriendStatus = 'none' | 'pending' | 'friends';
export interface Friended {
  id: string; friendshipId: string; display_name: string;
  avatar_url?: string; bio?: string; bodyweight_lbs?: number;
  is_owner?: boolean; is_og?: boolean; is_pro?: boolean;
}

interface Data {
  profile: any;
  prs: any[];
  workouts: any[];
  workoutCount: number;
  split: { splitLabel: string; sessionsPerWeek: number } | null;
  rank: ReturnType<typeof getRankResult>;
  power: number | null;
  powerPartial: boolean;
  status: FriendStatus;
  myRank: ReturnType<typeof getRankResult> | null;
  photos: Record<string, string>;
}

// Per-profile cache (60s TTL) — reopening a profile renders instantly.
const cache = new Map<string, Data & { at: number }>();
const SBD = ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts'];

function detectSplit(workouts: any[]) {
  if (!workouts?.length) return null;
  const classified = workouts.map(w => ({ type: classifySession(w.workout_sets ?? []), ts: new Date(w.started_at).getTime() }));
  const recent = classified.filter(c => c.ts > Date.now() - 28 * 86400000).length;
  const types = [...new Set(classified.map(c => c.type).filter(t => t !== 'Other'))];
  let splitLabel = 'Custom';
  if (types.includes('Push') && types.includes('Pull') && types.includes('Legs')) splitLabel = 'Push / Pull / Legs';
  else if ((types.includes('Upper') || (types.includes('Push') && types.includes('Pull'))) && types.includes('Legs')) splitLabel = 'Upper / Lower';
  else if (types.includes('Upper') && types.includes('Legs')) splitLabel = 'Upper / Lower';
  else if (types.length > 0 && types.every(t => t === 'Full Body')) splitLabel = 'Full Body';
  else if (types.length === 1 && types[0]) splitLabel = types[0];
  return { splitLabel, sessionsPerWeek: Math.round((recent / 4) * 10) / 10 };
}

/** Everything the friend profile sheet shows, plus add-friend and report/block. */
export function useFriendProfile(
  userId: string | null,
  visible: boolean,
  me: { id: string } | null,
  myBodyweight: number | null | undefined,
  onFriended?: (f: Friended) => void,
  onClose?: () => void,
) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const { reportContent, blockUser } = useModeration();

  useEffect(() => {
    if (!visible || !userId) return;
    const cached = cache.get(userId);
    if (cached) { setData(cached); setLoading(false); if (Date.now() - cached.at < 60_000) return; }
    else { setData(null); setLoading(true); }

    Promise.all([
      supabase.from('public_profiles').select('*').eq('id', userId).single(),
      supabase.from('personal_records').select('weight, reps, achieved_at, exercises(name, muscle_group)').eq('user_id', userId).order('achieved_at', { ascending: false }),
      supabase.from('workouts').select('id, name, started_at, ended_at, notes, workout_sets(weight, reps, exercises(name, muscle_group))')
        .eq('user_id', userId).not('ended_at', 'is', null).or('is_imported.is.null,is_imported.eq.false')
        .order('started_at', { ascending: false }).limit(20),
      supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('ended_at', 'is', null),
      me
        ? supabase.from('friendships').select('status').or(`requester_id.eq.${me.id},addressee_id.eq.${me.id}`)
            .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`).maybeSingle()
        : Promise.resolve({ data: null as any }),
      me && me.id !== userId
        ? supabase.from('personal_records').select('weight, reps, exercises(name)').eq('user_id', me.id)
        : Promise.resolve({ data: null as any }),
    ]).then(async ([{ data: prof }, { data: prs }, { data: workouts }, { count }, { data: fs }, { data: myPrs }]) => {
      const sbd = (rows: any[]) => (rows ?? []).filter((p: any) => SBD.includes(p.exercises?.name))
        .map((p: any) => ({ exerciseName: p.exercises?.name, weight: p.weight, reps: p.reps }));
      const rank = getRankResult(sbd(prs ?? []), prof?.bodyweight_lbs ?? 185);
      // Stored reading (migration 029) wins; otherwise estimate from their PRs.
      let power: number | null = prof?.power_level ?? null;
      let powerPartial = prof?.power_confidence === 'partial';
      if (power == null && (prs ?? []).length) {
        const r = computePowerReading((prs ?? []).map((p: any) => ({
          exerciseName: p.exercises?.name ?? '', weight: Number(p.weight), reps: p.reps, achievedAt: p.achieved_at,
        })), prof?.bodyweight_lbs, null);
        if (r.confidence !== 'calibrating') { power = r.power; powerPartial = r.confidence === 'partial'; }
      }
      const split = prof?.split_type || prof?.split_schedule
        ? { splitLabel: prof.split_type ?? 'Custom', sessionsPerWeek: Object.keys(prof.split_schedule ?? {}).length }
        : detectSplit(workouts ?? []);
      const status: FriendStatus = fs?.status === 'accepted' ? 'friends' : fs?.status === 'pending' ? 'pending' : 'none';

      const ids = (workouts ?? []).map((w: any) => w.id);
      const photos: Record<string, string> = {};
      if (ids.length) {
        const { data: rows } = await supabase.from('workout_photos').select('workout_id, photo_url').in('workout_id', ids);
        (rows ?? []).forEach((p: any) => { photos[p.workout_id] = p.photo_url; });
      }

      const next: Data = {
        profile: prof, prs: prs ?? [], workouts: workouts ?? [], workoutCount: count ?? 0, split, rank,
        power, powerPartial, status, myRank: myPrs ? getRankResult(sbd(myPrs), myBodyweight ?? 185) : null, photos,
      };
      cache.set(userId, { ...next, at: Date.now() });
      setData(next);
      setLoading(false);
    });
  }, [visible, userId]);

  const addFriend = async () => {
    if (!userId || !me) return;
    setAdding(true);
    try {
      const { data: row, error } = await supabase.from('friendships').insert({ requester_id: me.id, addressee_id: userId }).select('id, status').single();
      if (error) throw error;
      // The creator auto-accepts server-side (migration 012) — reflect it instantly.
      const status: FriendStatus = row?.status === 'accepted' ? 'friends' : 'pending';
      setData(d => (d ? { ...d, status } : d));
      const p = data?.profile;
      if (status === 'friends' && p) {
        onFriended?.({
          id: userId, friendshipId: row.id, display_name: p.display_name ?? 'Friend', avatar_url: p.avatar_url,
          bio: p.bio, bodyweight_lbs: p.bodyweight_lbs, is_owner: p.is_owner, is_og: p.is_og, is_pro: p.is_pro,
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAdding(false);
    }
  };

  // Report objectionable content or block an abusive user (Guideline 1.2)
  const safetyMenu = () => {
    if (!userId || userId === me?.id) return;
    const name = data?.profile?.display_name ?? 'this user';
    Alert.alert(name, 'Keep STR safe', [
      {
        text: 'Report user', onPress: () => Alert.alert('Report user', `Report ${name} for objectionable content or abusive behavior?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Report', style: 'destructive', onPress: async () => {
              const ok = await reportContent({ reportedUserId: userId, contentType: 'profile', contentId: userId });
              Alert.alert(ok ? 'Reported' : 'Error', ok ? 'Thanks — this will be reviewed within 24 hours.' : 'Could not file the report. Please try again.');
            },
          },
        ]),
      },
      {
        text: 'Block user', style: 'destructive', onPress: () => Alert.alert('Block user', `Block ${name}? You won't see their posts or profile.`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block', style: 'destructive', onPress: async () => {
              const ok = await blockUser(userId);
              if (ok) { Alert.alert('Blocked', `${name} has been blocked.`); onClose?.(); }
              else Alert.alert('Error', 'Could not block this user. Please try again.');
            },
          },
        ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return { data, loading, adding, addFriend, safetyMenu };
}
