import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors, TierName } from '@/constants/colors';
import { QRModal } from '@/components/QRModal';
import { TierLadderModal } from '@/components/TierLadderModal';
import { UserBadges } from '@/components/UserBadges';
import { MuscleHeatmap } from '@/components/MuscleHeatmap';
import { SbdStrengthCard, BodyPartRanksCard } from '@/components/profile/RankCards';
import { screenText } from '@/lib/contentFilter';
import { PaywallModal } from '@/components/PaywallModal';
import { useSubscription } from '@/hooks/useSubscription';
import { getTierForWeight, TIER_LABELS, TIER_ORDER } from '@/constants/strengthStandards';
import { getRankResult, ROMAN } from '@/constants/ranks';
import { toLbs, fmtVolume as fmtVolumeUnit, unitFromProfile } from '@/lib/units';

const SCREEN_W = Dimensions.get('window').width;

const TIER_COLORS: Record<TierName, string> = {
  beginner: Colors.tiers.beginner,
  bronze: Colors.tiers.bronze,
  silver: Colors.tiers.silver,
  gold: Colors.tiers.gold,
  platinum: Colors.tiers.platinum,
  diamond: Colors.tiers.diamond,
};

interface PREntry {
  exerciseName: string;
  weight: number;
  reps: number;
  tier: TierName;
}

interface MuscleGroupTier {
  group: string;
  tier: TierName;
  bestLift: string;
  weight: number;
}

interface ProfileStats {
  totalWorkouts: number;
  totalVolume: number;
  totalSets: number;
  prsHit: number;
  streakDays: number;
  allPRs: PREntry[];
  muscleGroupTiers: MuscleGroupTier[];
}

type WeeklyMetric = 'Volume' | 'Duration' | 'Sets';

const SESSION_COLORS: Record<string, string> = {
  Push: '#C2566B', Pull: '#3B82F6', Legs: '#F97316',
  Upper: '#A855F7', Lower: '#22C55E', 'Full Body': '#EAB308', Core: '#14B8A6',
};
const SESSION_TYPES = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Core'];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function splitLabelFromSchedule(schedule: Record<number, string>): string {
  const types = [...new Set(Object.values(schedule))];
  if (types.includes('Push') && types.includes('Pull') && types.includes('Legs')) return 'Push / Pull / Legs';
  if ((types.includes('Upper') || (types.includes('Push') && types.includes('Pull'))) && types.includes('Legs')) return 'Upper / Lower';
  if (types.includes('Upper') && types.includes('Legs')) return 'Upper / Lower';
  if (types.every(t => t === 'Full Body')) return 'Full Body';
  if (types.length === 1 && types[0]) return types[0];
  return 'Custom';
}

// ─── Weekly Activity Bar Chart ─────────────────────────────────────────────
function WeeklyChart({
  weeklyData,
}: {
  weeklyData: { day: string; volume: number; duration: number; sets: number }[];
}) {
  const [metric, setMetric] = useState<WeeklyMetric>('Volume');

  const getValue = (d: typeof weeklyData[0]) => {
    if (metric === 'Volume') return d.volume;
    if (metric === 'Duration') return d.duration;
    return d.sets;
  };

  const values = weeklyData.map(getValue);
  const maxVal = Math.max(...values, 1);

  const chartW = SCREEN_W - 40;
  const chartH = 80;
  const barAreaH = 60;
  const barGap = 4;
  const barCount = weeklyData.length;
  const barW = (chartW - barGap * (barCount - 1)) / barCount;

  const todayIdx = weeklyData.findIndex(d => d.day === 'Today');

  return (
    <View style={{
      backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 0,
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 }, elevation: 3,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800' }}>This Week</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['Volume', 'Duration', 'Sets'] as WeeklyMetric[]).map(m => (
            <TouchableOpacity
              key={m}
              onPress={() => setMetric(m)}
              style={{
                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                backgroundColor: metric === m ? Colors.accent : Colors.surface2,
                borderWidth: 1, borderColor: metric === m ? Colors.accent : Colors.border,
              }}
            >
              <Text style={{ color: Colors.text, fontSize: 10, fontWeight: '700' }}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Svg width={chartW} height={chartH + 20}>
        {weeklyData.map((d, i) => {
          const val = getValue(d);
          const barH = maxVal > 0 ? Math.max((val / maxVal) * barAreaH, val > 0 ? 4 : 0) : 0;
          const x = i * (barW + barGap);
          const y = barAreaH - barH;
          const isToday = i === todayIdx || d.day === 'Today';
          const barColor = isToday ? Colors.accent : Colors.accent + '70';

          return (
            <Svg key={i} x={x} y={0} width={barW} height={chartH + 20}>
              {/* Bar */}
              <Rect
                x={0} y={y} width={barW} height={barH > 0 ? barH : 0}
                rx={3} fill={barColor}
              />
              {/* Day label */}
              <SvgText
                x={barW / 2} y={barAreaH + 16}
                fontSize={9} fill={isToday ? Colors.accent : Colors.textMuted}
                textAnchor="middle" fontWeight={isToday ? '800' : '400'}
              >
                {d.day}
              </SvgText>
            </Svg>
          );
        })}
      </Svg>
    </View>
  );
}

export default function ProfileScreen() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  // NB: `unit` state below is the edit-modal picker; this is the live pref
  const displayUnit = unitFromProfile(profile?.unit_pref);
  const { isPro } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [usernameError, setUsernameError] = useState('');
  const [bodyweight, setBodyweight] = useState(profile?.bodyweight_lbs?.toString() ?? '');
  const [unit, setUnit] = useState<'lbs' | 'kg'>(profile?.unit_pref ?? 'lbs');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [rankResult, setRankTier] = useState<ReturnType<typeof getRankResult> | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{ day: string; volume: number; duration: number; sets: number }[]>([]);
  const [muscleVolume, setMuscleVolume] = useState<Record<string, number>>({});

  // Lifter DNA
  const [dnaModalOpen, setDnaModalOpen] = useState(false);
  const [dnaText, setDnaText] = useState(profile?.training_notes ?? '');
  const [dnaSaving, setDnaSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [bioEditing, setBioEditing] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showTierLadder, setShowTierLadder] = useState(false);
  const [sbdModalOpen, setSbdModalOpen] = useState(false);
  const [showSplitEditor, setShowSplitEditor] = useState(false);
  const [editSplitSchedule, setEditSplitSchedule] = useState<Record<number, string>>({});
  const [splitSaving, setSplitSaving] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [dayExercises, setDayExercises] = useState<Record<number, { id: string; name: string; muscle_group: string }[]>>({});
  const [coachEnabled, setCoachEnabled] = useState(true);
  const [expandedDayEx, setExpandedDayEx] = useState<number | null>(null);
  const [splitExSearch, setSplitExSearch] = useState('');
  const [allExercises, setAllExercises] = useState<{ id: string; name: string; muscle_group: string }[]>([]);
  const [sbdInputs, setSbdInputs] = useState({ sq: '', bp: '', dl: '' });
  const [sbdSaving, setSbdSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadStats();
      import('@react-native-async-storage/async-storage').then(({ default: AS }) =>
        AS.getItem(`coach_enabled_${user.id}`).then(v => { if (v !== null) setCoachEnabled(v === 'true'); })
      );
    }
  }, [user, profile?.bodyweight_lbs]);

  const loadStats = async () => {
    if (!user) return;
    setLoadingStats(true);
    try {
      // 8 days for timezone buffer
      const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const [
        { data: workouts },
        { data: prs },
        { count: friends },
        { data: weekWorkouts },
        { data: recentWorkouts },
        { data: volumeData },
      ] = await Promise.all([
        supabase.from('workouts').select('id, started_at').eq('user_id', user.id).not('ended_at', 'is', null),
        supabase.from('personal_records').select('weight, reps, achieved_at, exercises(name)').eq('user_id', user.id).order('achieved_at', { ascending: false }),
        supabase.from('friendships').select('id', { count: 'exact', head: true }).or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq('status', 'accepted'),
        supabase.from('workouts').select('id, started_at, ended_at').eq('user_id', user.id).not('ended_at', 'is', null).gte('started_at', eightDaysAgo),
        // 30-day muscle heatmap base set — independent of the above, batched together
        supabase.from('workouts').select('id').eq('user_id', user.id).not('ended_at', 'is', null).gte('started_at', thirtyDaysAgo),
        // All-time volume/sets — independent of the above, batched together
        supabase.from('workout_sets').select('weight, reps, workouts!inner(user_id)').eq('workouts.user_id', user.id),
      ]);

      setFriendCount(friends ?? 0);

      // Fetch sets separately — nested joins silently fail with some RLS configs
      const weekWorkoutIds = (weekWorkouts ?? []).map((w: any) => w.id);
      const { data: weekSets } = weekWorkoutIds.length > 0
        ? await supabase.from('workout_sets').select('workout_id, weight, reps').in('workout_id', weekWorkoutIds)
        : { data: [] };

      // Build weekly data (last 7 days)
      const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      const dayMap: Record<string, { volume: number; duration: number; sets: number }> = {};
      const today = new Date();
      const dayLabels: Record<string, string> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.toDateString();
        dayMap[key] = { volume: 0, duration: 0, sets: 0 };
        dayLabels[key] = i === 0 ? 'Today' : dayNames[d.getDay()];
      }

      // Map sets by workout_id
      const setsByWorkout: Record<string, { weight: number; reps: number }[]> = {};
      for (const s of weekSets ?? []) {
        const wid = (s as any).workout_id;
        if (!setsByWorkout[wid]) setsByWorkout[wid] = [];
        setsByWorkout[wid].push(s as any);
      }

      for (const w of weekWorkouts ?? []) {
        const key = new Date((w as any).started_at).toDateString();
        if (!dayMap[key]) continue;
        const sets = setsByWorkout[(w as any).id] ?? [];
        dayMap[key].volume += sets.reduce((s, x) => s + (x.weight ?? 0) * (x.reps ?? 0), 0);
        dayMap[key].sets += sets.length;
        if ((w as any).ended_at) {
          dayMap[key].duration += Math.round(
            (new Date((w as any).ended_at).getTime() - new Date((w as any).started_at).getTime()) / 60000
          );
        }
      }

      const weekly = Object.entries(dayMap).map(([key, v]) => ({
        day: dayLabels[key] ?? key,
        volume: v.volume,
        duration: v.duration,
        sets: v.sets,
      }));
      setWeeklyData(weekly);

      // ── 30-day muscle heatmap: sets per muscle group ──────────────────────
      // Count sets (not weight×reps) so bodyweight work still registers — a set
      // is a set whether it's loaded or not.
      const recentIds = (recentWorkouts ?? []).map((w: any) => w.id);
      const { data: recentSets } = recentIds.length > 0
        ? await supabase
            .from('workout_sets')
            .select('exercises(muscle_group)')
            .in('workout_id', recentIds)
        : { data: [] as any[] };
      const volByGroup: Record<string, number> = {};
      for (const s of (recentSets ?? []) as any[]) {
        const mg = s.exercises?.muscle_group;
        if (!mg) continue;
        volByGroup[mg] = (volByGroup[mg] ?? 0) + 1;
      }
      setMuscleVolume(volByGroup);

      // Streak calculation
      const daySet = new Set((workouts ?? []).map(w => new Date(w.started_at).toDateString()));
      let streak = 0;
      for (let d = 0; d < 90; d++) {
        const day = new Date();
        day.setDate(day.getDate() - d);
        if (daySet.has(day.toDateString())) streak++;
        else if (d > 0) break;
      }

      const bw = profile?.bodyweight_lbs ?? 185;
      const allPRs: PREntry[] = (prs ?? []).map((p: any) => ({
        exerciseName: p.exercises?.name ?? '',
        weight: p.weight,
        reps: p.reps,
        tier: getTierForWeight(p.exercises?.name ?? '', p.weight, bw),
      }))
        .filter(p => p.exerciseName)
        .sort((a, b) => {
          const tierDiff = TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier);
          if (tierDiff !== 0) return tierDiff;
          return a.exerciseName.localeCompare(b.exerciseName);
        });

      const sbdPRs = allPRs
        .filter(p => ['Barbell Back Squats', 'Barbell Bench Press', 'Deadlifts'].includes(p.exerciseName))
        .map(p => ({ exerciseName: p.exerciseName, weight: p.weight, reps: p.reps }));
      setRankTier(getRankResult(sbdPRs, bw));

      const totalVolume = (volumeData ?? []).reduce((s: number, x: any) => s + x.weight * x.reps, 0);
      const totalSets = (volumeData ?? []).length;

      const groupMap: Record<string, { tier: TierName; bestLift: string; weight: number }> = {};
      for (const pr of allPRs) {
        // pr.tier comes from getTierForWeight (above); only ranked lifts (the
        // SBD lifts) return a non-beginner tier, so that gate is sufficient.
        if (pr.tier === 'beginner') continue;
        const prRow = (prs ?? []).find((p: any) => p.exercises?.name === pr.exerciseName) as any;
        const mg = prRow?.exercises?.muscle_group ?? 'Overall';
        if (!groupMap[mg] || TIER_ORDER.indexOf(pr.tier) > TIER_ORDER.indexOf(groupMap[mg].tier)) {
          groupMap[mg] = { tier: pr.tier, bestLift: pr.exerciseName, weight: pr.weight };
        }
      }
      const muscleGroupTiers: MuscleGroupTier[] = Object.entries(groupMap)
        .sort((a, b) => TIER_ORDER.indexOf(b[1].tier) - TIER_ORDER.indexOf(a[1].tier))
        .map(([group, data]) => ({ group, ...data }));

      setStats({
        totalWorkouts: workouts?.length ?? 0,
        totalVolume,
        totalSets,
        prsHit: prs?.length ?? 0,
        streakDays: streak,
        allPRs,
        muscleGroupTiers,
      });
    } catch (e) {
      // silence
    } finally {
      setLoadingStats(false);
    }
  };

  const saveProfile = async () => {
    const bw = parseFloat(bodyweight);
    if (!bw || bw < 50) { Alert.alert('Invalid bodyweight'); return; }

    const uname = username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
    if (username.trim() && uname.length < 3) { setUsernameError('Username must be at least 3 characters'); return; }
    setUsernameError('');

    // Objectionable-content screen (Guideline 1.2)
    const nameIssue = screenText(displayName, 'display name') || screenText(uname, 'username');
    if (nameIssue) { Alert.alert('Not allowed', nameIssue); return; }

    if (uname && uname !== profile?.username) {
      const { data: existing } = await supabase.from('public_profiles').select('id').eq('username', uname).neq('id', user!.id).maybeSingle();
      if (existing) { setUsernameError('That username is already taken'); return; }
    }

    setSaving(true);
    const bwLbs = unit === 'kg' ? bw * 2.205 : bw;
    const { error } = await supabase.from('users').update({
      display_name: displayName.trim(),
      bodyweight_lbs: Math.round(bwLbs * 10) / 10,
      unit_pref: unit,
      username: uname || null,
    }).eq('id', user!.id);
    if (error) {
      if (error.code === '23505') setUsernameError('That username is already taken');
      else Alert.alert('Error', error.message);
    } else { await refreshProfile(); setEditing(false); }
    setSaving(false);
  };

  const saveDNA = async () => {
    if (!user) return;
    setDnaSaving(true);
    const { error } = await supabase.from('users').update({ training_notes: dnaText.trim() || null }).eq('id', user.id);
    if (error) Alert.alert('Error', error.message);
    else { await refreshProfile(); setDnaModalOpen(false); }
    setDnaSaving(false);
  };

  const pickAndUploadPhoto = async () => {
    const launch = async (fromCamera: boolean) => {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Camera permission needed'); return; }
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
        if (result.canceled || !result.assets[0]) return;
        uploadPhoto(result.assets[0].uri);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission needed'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
        if (result.canceled || !result.assets[0]) return;
        uploadPhoto(result.assets[0].uri);
      }
    };
    Alert.alert('Profile Photo', 'Choose a source', [
      { text: '📷 Take Photo', onPress: () => launch(true) },
      { text: '🖼️ Choose from Library', onPress: () => launch(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadPhoto = async (uri: string) => {
    if (!uri) return;
    setUploadingPhoto(true);
    try {
      const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
      const fileName = `${user!.id}.${ext}`;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, bytes, { upsert: true, contentType: `image/${ext}` });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;
      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user!.id);
      await refreshProfile();
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload photo. Make sure the avatars bucket exists in Supabase Storage.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveBio = async () => {
    if (!user) return;
    const bioIssue = screenText(bio, 'bio');
    if (bioIssue) { Alert.alert('Not allowed', bioIssue); return; }
    await supabase.from('users').update({ bio: bio.trim() || null }).eq('id', user.id);
    await refreshProfile();
    setBioEditing(false);
  };

  const saveSBD = async () => {
    if (!user) return;
    const entries = [
      { key: 'barbell back squats', val: sbdInputs.sq, name: 'Barbell Back Squats' },
      { key: 'barbell bench press', val: sbdInputs.bp, name: 'Barbell Bench Press' },
      { key: 'deadlifts', val: sbdInputs.dl, name: 'Deadlifts' },
    ].filter(e => parseFloat(e.val) > 0);
    if (entries.length === 0) { Alert.alert('Enter at least one lift'); return; }
    setSbdSaving(true);
    try {
      const { data: exRows } = await supabase.from('exercises').select('id, name').in('name', entries.map(e => e.name));
      for (const entry of entries) {
        const ex = (exRows ?? []).find((e: any) => e.name.toLowerCase() === entry.key);
        if (!ex) continue;
        await supabase.from('personal_records').upsert({
          user_id: user.id, exercise_id: ex.id,
          // Typed in the user's display unit — stored canonical lbs
          weight: toLbs(parseFloat(entry.val), displayUnit), reps: 1,
          achieved_at: new Date().toISOString(),
        }, { onConflict: 'user_id,exercise_id' });
      }
      setSbdModalOpen(false);
      setSbdInputs({ sq: '', bp: '', dl: '' });
      await loadStats();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSbdSaving(false);
    }
  };

  const saveSplit = async () => {
    if (!user) return;
    setSplitSaving(true);
    const label = splitLabelFromSchedule(editSplitSchedule);
    const { error } = await supabase.from('users').update({
      split_type: label,
      split_schedule: Object.keys(editSplitSchedule).length > 0 ? editSplitSchedule : null,
    }).eq('id', user.id);
    if (error) {
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        Alert.alert('Setup needed', 'Run this SQL in Supabase:\n\nALTER TABLE public.users\nADD COLUMN IF NOT EXISTS split_type TEXT,\nADD COLUMN IF NOT EXISTS split_schedule JSONB;');
      } else {
        Alert.alert('Error', error.message);
      }
      setSplitSaving(false);
      return;
    }

    // Save exercises per day as pinned workout templates
    // Use delete + insert (not upsert) — avoids needing a unique constraint
    for (const [dayStr, exercises] of Object.entries(dayExercises)) {
      const dayIdx = Number(dayStr);
      const sessionType = editSplitSchedule[dayIdx];
      if (!sessionType) continue; // skip days with no session type
      // Unpin anything already on this day
      await supabase.from('workout_templates')
        .update({ day_of_week: null })
        .eq('user_id', user.id)
        .eq('day_of_week', dayIdx);
      if (exercises.length === 0) continue; // nothing to save
      // Insert fresh template
      const { error: tmplErr } = await supabase.from('workout_templates').insert({
        user_id: user.id,
        name: `${sessionType} Day`,
        exercises: exercises.map(e => ({ id: e.id, name: e.name, muscle_group: e.muscle_group })),
        day_of_week: dayIdx,
      });
      if (tmplErr) {
        console.warn('[Split] template save error:', tmplErr.message);
        if (tmplErr.message?.includes('day_of_week')) {
          Alert.alert('Run SQL first', 'In Supabase SQL editor run:\nALTER TABLE public.workout_templates ADD COLUMN IF NOT EXISTS day_of_week integer;');
          setSplitSaving(false);
          return;
        }
      }
    }

    await refreshProfile();
    setShowSplitEditor(false);
    setSplitSaving(false);
  };

  const openSplitEditor = async () => {
    const existing = (profile?.split_schedule ?? {}) as Record<string, string>;
    const converted: Record<number, string> = {};
    Object.entries(existing).forEach(([k, v]) => { converted[Number(k)] = v; });
    setEditSplitSchedule(converted);
    if (user) {
      const [{ data: templates }, { data: exercises }] = await Promise.all([
        supabase.from('workout_templates').select('*').eq('user_id', user.id).order('last_used_at', { ascending: false, nullsFirst: false }),
        supabase.from('exercises').select('id, name, muscle_group').order('name'),
      ]);
      setSavedTemplates(templates ?? []);
      setAllExercises(exercises ?? []);
      // Pre-load existing pinned day templates
      const init: Record<number, any[]> = {};
      (templates ?? []).filter((t: any) => t.day_of_week != null).forEach((t: any) => {
        init[t.day_of_week] = t.exercises ?? [];
      });
      setDayExercises(init);
    }
    setExpandedDayEx(null);
    setSplitExSearch('');
    setShowSplitEditor(true);
  };

  const pickDaySession = (dayIdx: number) => {
    const current = editSplitSchedule[dayIdx];
    Alert.alert(
      DAY_FULL[dayIdx],
      'What do you train?',
      [
        ...SESSION_TYPES.map(type => ({
          text: type === current ? `${type} ✓` : type,
          onPress: () => {
            setEditSplitSchedule(prev => ({ ...prev, [dayIdx]: type }));
            // Offer to link a template for this day
            setTimeout(() => {
              Alert.alert(
                `Pin a template for ${DAY_FULL[dayIdx]}?`,
                savedTemplates.length > 0
                  ? 'Choose a saved template — it will pre-load every time you train this day.'
                  : 'No saved templates yet. Log a workout first, then you can pin it here.',
                [
                  ...savedTemplates.slice(0, 4).map((tmpl: any) => ({
                    text: tmpl.name,
                    onPress: async () => {
                      await supabase.from('workout_templates').update({ day_of_week: null }).eq('user_id', user!.id).eq('day_of_week', dayIdx);
                      await supabase.from('workout_templates').update({ day_of_week: dayIdx }).eq('id', tmpl.id);
                      Alert.alert('Pinned! 📌', `${tmpl.name} will pre-load every ${DAY_FULL[dayIdx]}.`);
                    },
                  })),
                  { text: savedTemplates.length === 0 ? 'Got it' : 'Skip for now', style: 'cancel' },
                ]
              );
            }, 400);
          },
        })),
        { text: 'Rest (clear)', style: 'destructive' as const, onPress: () => setEditSplitSchedule(prev => { const n = { ...prev }; delete n[dayIdx]; return n; }) },
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  const formatVolume = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
    return String(v);
  };

  const bwDisplay = profile?.unit_pref === 'kg' && profile.bodyweight_lbs
    ? `${(profile.bodyweight_lbs / 2.205).toFixed(1)} kg`
    : `${profile?.bodyweight_lbs ?? '—'} lbs`;

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const tierColor = rankResult?.tier.color ?? Colors.accent;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── SOCIAL HEADER ──────────────────────────────────────────────────── */}
        <View style={{
          paddingTop: 24, paddingBottom: 20, paddingHorizontal: 20,
          borderBottomWidth: 1, borderBottomColor: Colors.border,
        }}>
          {/* Top row: avatar + name/username/badges */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            {/* Avatar */}
            <TouchableOpacity onPress={pickAndUploadPhoto} disabled={uploadingPhoto}>
              <View style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: tierColor + '20',
                borderWidth: 2.5, borderColor: tierColor + '80',
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                {uploadingPhoto ? (
                  <ActivityIndicator color={tierColor} />
                ) : profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={{ width: 80, height: 80, borderRadius: 40 }} cachePolicy="disk" transition={150} />
                ) : (
                  <Text style={{ color: tierColor, fontWeight: '800', fontSize: 26 }}>
                    {initials(profile?.display_name ?? user?.email ?? '?')}
                  </Text>
                )}
              </View>
              <View style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.bg,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 11 }}>📷</Text>
              </View>
            </TouchableOpacity>

            {/* Name / username / badges */}
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2 }}>
                {profile?.display_name ?? user?.email}
              </Text>
              {profile?.username && (
                <Text style={{ color: Colors.accent, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>
                  @{profile.username}
                </Text>
              )}
              <UserBadges isPro={profile?.is_pro} isOwner={profile?.is_owner} isOg={profile?.is_og} size="sm" />
            </View>
          </View>

          {/* Social stats pills */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Workouts', value: stats?.totalWorkouts ?? '—' },
              { label: 'Friends', value: friendCount },
              { label: 'PRs', value: stats?.prsHit ?? '—' },
            ].map((s, i) => (
              <View key={i} style={{
                flex: 1,
                backgroundColor: Colors.surface,
                borderRadius: 14,
                padding: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: Colors.border,
              }}>
                <Text style={{
                  color: Colors.text,
                  fontSize: 18,
                  fontWeight: '800',
                  letterSpacing: -0.5,
                }}>
                  {String(s.value)}
                </Text>
                <Text style={{
                  color: Colors.textMuted,
                  fontSize: 10,
                  marginTop: 3,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  fontWeight: '600',
                }}>
                  {s.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Bio */}
          {bioEditing ? (
            <View style={{ gap: 8, marginBottom: 8 }}>
              <TextInput
                value={bio}
                onChangeText={setBio}
                autoFocus
                multiline
                placeholder="Add a bio..."
                placeholderTextColor={Colors.textMuted}
                maxLength={150}
                style={{
                  backgroundColor: Colors.surface, borderRadius: 10,
                  paddingHorizontal: 14, paddingVertical: 10,
                  color: Colors.text, fontSize: 14,
                  borderWidth: 1, borderColor: Colors.border, lineHeight: 20,
                }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => { setBioEditing(false); setBio(profile?.bio ?? ''); }}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}
                >
                  <Text style={{ color: Colors.textMuted, fontSize: 12, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveBio}
                  style={{ flex: 2, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.accent, alignItems: 'center' }}
                >
                  <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '800' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
              <Text style={{
                color: profile?.bio ? Colors.textSecondary : Colors.textMuted,
                fontSize: 13, lineHeight: 20, flex: 1,
                fontStyle: profile?.bio ? 'normal' : 'italic',
              }}>
                {profile?.bio ?? 'Add a bio...'}
              </Text>
              <TouchableOpacity onPress={() => { setBio(profile?.bio ?? ''); setBioEditing(true); }} style={{ paddingTop: 2 }}>
                <Text style={{ color: Colors.textMuted, fontSize: 13 }}>✏️</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => {
                setDisplayName(profile?.display_name ?? '');
                setUsername(profile?.username ?? '');
                setBodyweight(profile?.bodyweight_lbs?.toString() ?? '');
                setUnit(profile?.unit_pref ?? 'lbs');
                setEditing(true);
              }}
              style={{ paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border }}
            >
              <Text style={{ color: Colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowQR(true)}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.accent + '50', backgroundColor: Colors.accentDim }}
            >
              <Text style={{ color: Colors.accent, fontWeight: '700', fontSize: 13 }}>QR Code</Text>
            </TouchableOpacity>
            <Text style={{ color: Colors.textMuted, fontSize: 12, alignSelf: 'center', marginLeft: 'auto' }}>
              {bwDisplay}
            </Text>
          </View>
        </View>

        <View style={{ padding: 20, gap: 16 }}>

          {/* ── WEEKLY ACTIVITY CHART ────────────────────────────────────────── */}
          {weeklyData.length > 0 && <WeeklyChart weeklyData={weeklyData} />}

          {/* ── RANK CARD ──────────────────────────────────────────────── */}
          {rankResult && (
            <TouchableOpacity
              onPress={() => setShowTierLadder(true)}
              activeOpacity={0.85}
              style={{
                backgroundColor: tierColor + '10',
                borderRadius: 18,
                padding: 20,
                borderWidth: 1.5,
                borderColor: tierColor + '45',
                alignItems: 'center',
                gap: 10,
                shadowColor: tierColor,
                shadowOpacity: 0.15,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 6 },
                elevation: 6,
              }}
            >
              {/* Rank badge row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  backgroundColor: tierColor + '22',
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: tierColor + '50',
                }}>
                  <Text style={{
                    color: tierColor,
                    fontWeight: '800',
                    fontSize: 14,
                    letterSpacing: 2.5,
                    textTransform: 'uppercase',
                    textShadowColor: tierColor,
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 6,
                  }}>
                    {rankResult.tier.label} {ROMAN[rankResult.subTier]}
                  </Text>
                </View>
                <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                  {rankResult.avgScore > 0 ? `${rankResult.avgScore.toFixed(1)} / 5.0` : 'Set SBD to rank'}
                </Text>
              </View>

              <Text style={{
                color: Colors.textSecondary,
                fontSize: 13,
                fontStyle: 'italic',
                textAlign: 'center',
                lineHeight: 20,
                paddingHorizontal: 8,
              }}>
                "{rankResult.tier.tagline}"
              </Text>

              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                paddingTop: 4,
                borderTopWidth: 1,
                borderTopColor: tierColor + '25',
              }}>
                <Text style={{ color: tierColor, fontSize: 10, fontWeight: '700', opacity: 0.65, letterSpacing: 0.5 }}>
                  Tap to see all ranks →
                </Text>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation?.(); setSbdModalOpen(true); }}
                  style={{
                    backgroundColor: tierColor + '18',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderWidth: 1,
                    borderColor: tierColor + '40',
                  }}
                >
                  <Text style={{ color: tierColor, fontSize: 11, fontWeight: '800' }}>
                    {rankResult.lifts.some(l => l.weight > 0) ? 'Update SBD' : 'Set SBD →'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}

          {/* ── STATS ───────────────────────────────────────────────────────── */}
          {!loadingStats && stats && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { label: 'Workouts', value: String(stats.totalWorkouts), color: null },
                { label: 'Volume', value: fmtVolumeUnit(stats.totalVolume, displayUnit), color: null },
                { label: 'Streak', value: `${stats.streakDays}d`, color: Colors.gold },
              ].map((s, i) => (
                <View key={i} style={{
                  flex: 1,
                  backgroundColor: Colors.surface,
                  borderRadius: 14,
                  padding: 14,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: s.color ? s.color + '30' : Colors.border,
                }}>
                  <Text style={{
                    color: Colors.textMuted,
                    fontSize: 9,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}>
                    {s.label}
                  </Text>
                  <Text style={{
                    color: s.color ?? Colors.text,
                    fontSize: 20,
                    fontWeight: '800',
                    letterSpacing: -0.5,
                  }}>
                    {s.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* ── SBD TIERS ───────────────────────────────────────────────────── */}
          {rankResult && <SbdStrengthCard result={rankResult} />}

          {/* ── BODY PART TIERS ─────────────────────────────────────────────── */}
          {stats && <BodyPartRanksCard tiers={stats.muscleGroupTiers} />}

          {/* ── 30-DAY MUSCLE HEATMAP ───────────────────────────────────────── */}
          {!loadingStats && Object.keys(muscleVolume).length > 0 && (
            <View style={{
              backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
              shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 }, elevation: 3,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>
                  Last 30 Days
                </Text>
                <Text style={{ color: Colors.textMuted, fontSize: 10 }}>volume by muscle</Text>
              </View>
              <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 12, lineHeight: 17 }}>
                Where your work went — spot what's overcooked and what's getting skipped.
              </Text>
              <MuscleHeatmap volumeByGroup={muscleVolume} />
            </View>
          )}

          {/* ── MY SPLIT ──────────────────────────────────────────────────────── */}
          {(() => {
            const storedSchedule = (profile?.split_schedule ?? {}) as Record<string, string>;
            const hasSplit = profile?.split_type || Object.keys(storedSchedule).length > 0;
            const splitLabel = profile?.split_type ?? splitLabelFromSchedule(
              Object.fromEntries(Object.entries(storedSchedule).map(([k, v]) => [Number(k), v]))
            );
            const weekGrid: Array<{ type: string; color: string } | null> = Array(7).fill(null);
            Object.entries(storedSchedule).forEach(([day, type]) => {
              weekGrid[Number(day)] = { type, color: SESSION_COLORS[type] ?? Colors.textMuted };
            });

            return (
              <TouchableOpacity
                onPress={openSplitEditor}
                activeOpacity={0.85}
                style={{
                  backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
                  borderWidth: 1, borderColor: hasSplit ? Colors.accent + '40' : Colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasSplit ? 12 : 0 }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>My Split</Text>
                  <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700' }}>
                    {hasSplit ? 'Edit ✏️' : 'Set up →'}
                  </Text>
                </View>

                {hasSplit ? (
                  <>
                    <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5, marginBottom: 14 }}>
                      {splitLabel}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 5 }}>
                      {[1, 2, 3, 4, 5, 6, 0].map((dayIdx, col) => {
                        const session = weekGrid[dayIdx];
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
                              {DAY_LABELS[dayIdx]}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    {(() => {
                      const seenTypes = [...new Set(Object.values(storedSchedule))];
                      return seenTypes.length > 0 ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                          {seenTypes.map((type, i) => (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: SESSION_COLORS[type] ?? Colors.textMuted }} />
                              <Text style={{ color: Colors.textMuted, fontSize: 10, fontWeight: '600' }}>{type}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null;
                    })()}
                  </>
                ) : (
                  <Text style={{ color: Colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 20 }}>
                    Tell your crew what split you're running. Coach uses this too.
                  </Text>
                )}
              </TouchableOpacity>
            );
          })()}

          {loadingStats && <ActivityIndicator color={Colors.textMuted} />}

          {/* ── LIFTER DNA ───────────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => { setDnaText(profile?.training_notes ?? ''); setDnaModalOpen(true); }}
            style={{
              backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1,
              borderColor: profile?.training_notes ? Colors.accent + '50' : Colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800' }}>Lifter DNA</Text>
              <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700' }}>{profile?.training_notes ? 'Edit' : 'Add →'}</Text>
            </View>
            <Text style={{ color: Colors.textMuted, fontSize: 12, lineHeight: 18 }}>
              {profile?.training_notes
                ? profile.training_notes.slice(0, 120) + (profile.training_notes.length > 120 ? '…' : '')
                : 'Injuries, goals, what works. Coach reads this before every response.'}
            </Text>
          </TouchableOpacity>

          {/* ── SUBSCRIPTION ─────────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => !isPro && setShowPaywall(true)}
            activeOpacity={isPro ? 1 : 0.8}
            style={{
              backgroundColor: isPro ? Colors.accent + '12' : Colors.surface,
              borderRadius: 16, padding: 18,
              borderWidth: 1.5,
              borderColor: isPro ? Colors.accent + '50' : Colors.border,
              flexDirection: 'row', alignItems: 'center', gap: 14,
            }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: isPro ? Colors.accent + '20' : Colors.surface2,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 20 }}>{isPro ? '⚡' : '🔓'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>
                {isPro ? 'STR Pro' : 'Free Plan'}
              </Text>
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {isPro
                  ? 'Unlimited Coach · Full history · Priority responses'
                  : 'Upgrade for unlimited AI Coach, full history & more'}
              </Text>
            </View>
            {isPro ? (
              <View style={{
                backgroundColor: Colors.accent + '25', borderRadius: 8,
                paddingHorizontal: 10, paddingVertical: 4,
              }}>
                <Text style={{ color: Colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>ACTIVE</Text>
              </View>
            ) : (
              <Text style={{ color: Colors.accent, fontSize: 13, fontWeight: '800' }}>Upgrade →</Text>
            )}
          </TouchableOpacity>

          {/* Redeem code — shown for free users */}
          {!isPro && (
            <TouchableOpacity
              onPress={async () => {
                try {
                  const Purchases = require('react-native-purchases').default;
                  await Purchases.presentCodeRedemptionSheet();
                } catch {}
              }}
              style={{ alignItems: 'center', paddingVertical: 4 }}
            >
              <Text style={{ color: Colors.accent, fontSize: 13, fontWeight: '700' }}>
                Have a code? Redeem it →
              </Text>
            </TouchableOpacity>
          )}

          {/* ── COACH DURING SETS ────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={async () => {
              const next = !coachEnabled;
              setCoachEnabled(next);
              const AS = (await import('@react-native-async-storage/async-storage')).default;
              if (user) await AS.setItem(`coach_enabled_${user.id}`, String(next));
            }}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
              borderWidth: 1, borderColor: Colors.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>Coach during sets</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>
                RPE feedback and tips after each set
              </Text>
            </View>
            <View style={{
              width: 44, height: 26, borderRadius: 13,
              backgroundColor: coachEnabled ? Colors.accent : Colors.surface2,
              justifyContent: 'center', paddingHorizontal: 3,
              borderWidth: 1, borderColor: coachEnabled ? Colors.accent : Colors.border,
            }}>
              <View style={{
                width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.text,
                transform: [{ translateX: coachEnabled ? 18 : 0 }],
              }} />
            </View>
          </TouchableOpacity>

          {/* ── PUBLIC PROFILE ───────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={async () => {
              const next = !((profile as any)?.profile_public ?? true);
              if (user) {
                await supabase.from('users').update({ profile_public: next } as any).eq('id', user.id);
                refreshProfile();
              }
            }}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
              borderWidth: 1, borderColor: Colors.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>Public profile</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>
                Your posts and PRs appear in the Global feed. Off = friends only.
              </Text>
            </View>
            <View style={{
              width: 44, height: 26, borderRadius: 13,
              backgroundColor: ((profile as any)?.profile_public ?? true) ? Colors.accent : Colors.surface2,
              justifyContent: 'center', paddingHorizontal: 3,
              borderWidth: 1, borderColor: ((profile as any)?.profile_public ?? true) ? Colors.accent : Colors.border,
            }}>
              <View style={{
                width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.text,
                transform: [{ translateX: ((profile as any)?.profile_public ?? true) ? 18 : 0 }],
              }} />
            </View>
          </TouchableOpacity>

          {/* ── SIGN OUT ─────────────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={signOut}
            style={{ paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.danger, alignItems: 'center' }}
          >
            <Text style={{ color: Colors.danger, fontWeight: '700', fontSize: 14 }}>Sign Out</Text>
          </TouchableOpacity>

          {/* ── DELETE ACCOUNT ───────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Delete Account',
                'This will permanently delete your account, all workouts, PRs, and data. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete My Account',
                    style: 'destructive',
                    onPress: () => {
                      Alert.alert(
                        'Are you sure?',
                        'Your entire training history will be lost forever.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Yes, Delete Everything',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                if (!user) return;
                                const { error } = await supabase.rpc('delete_user');
                                if (error) throw error;
                                await signOut();
                              } catch (e: any) {
                                Alert.alert('Error', e.message ?? 'Could not delete account. Please contact support@str.app');
                              }
                            },
                          },
                        ]
                      );
                    },
                  },
                ]
              );
            }}
            style={{ paddingVertical: 12, alignItems: 'center' }}
          >
            <Text style={{ color: Colors.textMuted, fontWeight: '500', fontSize: 12 }}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Tier Ladder Modal */}
      <TierLadderModal visible={showTierLadder} onClose={() => setShowTierLadder(false)} result={rankResult} bodyweightLbs={profile?.bodyweight_lbs ?? 185} gender={profile?.gender} />

      {/* Paywall */}
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} reason="Unlock unlimited AI Coach, full workout history, and more." />

      {/* QR Modal */}
      {user && (
        <QRModal
          visible={showQR}
          userId={user.id}
          username={profile?.username ?? undefined}
          displayName={profile?.display_name ?? 'Athlete'}
          tierLabel={rankResult?.tier.label}
          tierColor={rankResult?.tier.color}
          onClose={() => setShowQR(false)}
        />
      )}

      {/* SBD Entry Modal */}
      <Modal visible={sbdModalOpen} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={() => setSbdModalOpen(false)} />
          <View style={{
            backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, borderTopWidth: 1, borderTopColor: Colors.border, gap: 16,
          }}>
            <View>
              <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Your SBD Maxes</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 13, marginTop: 4 }}>
                Best single or heavy working set. Updates your rank instantly.
              </Text>
            </View>
            {[
              { label: 'Squat', key: 'sq' as const, placeholder: '315' },
              { label: 'Bench', key: 'bp' as const, placeholder: '225' },
              { label: 'Deadlift', key: 'dl' as const, placeholder: '405' },
            ].map(({ label, key, placeholder }) => (
              <View key={key}>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
                  {label} ({displayUnit})
                </Text>
                <TextInput
                  value={sbdInputs[key]}
                  onChangeText={v => setSbdInputs(prev => ({ ...prev, [key]: v }))}
                  keyboardType="number-pad"
                  placeholder={placeholder}
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    backgroundColor: Colors.surface2, borderRadius: 12,
                    paddingHorizontal: 16, paddingVertical: 14,
                    color: Colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -1,
                    borderWidth: 1, borderColor: Colors.border,
                  }}
                />
              </View>
            ))}
            <TouchableOpacity
              onPress={saveSBD}
              disabled={sbdSaving}
              style={{ backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 }}
            >
              {sbdSaving ? <ActivityIndicator color={Colors.text} /> : <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 16 }}>SAVE & UPDATE RANK</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── EDIT MODAL ──────────────────────────────────────────────────────── */}
      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: 20, paddingVertical: 16,
              borderBottomWidth: 1, borderBottomColor: Colors.border,
            }}>
              <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '800' }}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <Text style={{ color: Colors.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Display Name</Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  style={{ backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: Colors.text, fontSize: 16 }}
                />
              </View>
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Username</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderColor: usernameError ? Colors.danger : Colors.border, borderWidth: 1, borderRadius: 12 }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 16, paddingLeft: 16 }}>@</Text>
                  <TextInput
                    value={username}
                    onChangeText={v => { setUsername(v); setUsernameError(''); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="yourhandle"
                    placeholderTextColor={Colors.textMuted}
                    style={{ flex: 1, paddingHorizontal: 8, paddingVertical: 14, color: Colors.text, fontSize: 16 }}
                  />
                </View>
                {usernameError ? (
                  <Text style={{ color: Colors.danger, fontSize: 11, marginTop: 4 }}>{usernameError}</Text>
                ) : (
                  <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 4 }}>Friends can find you with @{username || 'handle'}</Text>
                )}
              </View>
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Unit</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['lbs', 'kg'] as const).map(u => (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setUnit(u)}
                      style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: unit === u ? Colors.accent : Colors.surface, borderWidth: 1, borderColor: unit === u ? Colors.accent : Colors.border }}
                    >
                      <Text style={{ color: Colors.text, fontWeight: '700', textTransform: 'uppercase', fontSize: 14 }}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Bodyweight ({unit})</Text>
                <TextInput
                  value={bodyweight}
                  onChangeText={setBodyweight}
                  keyboardType="decimal-pad"
                  style={{ backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: Colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -1 }}
                />
              </View>
              <TouchableOpacity
                onPress={saveProfile}
                disabled={saving}
                style={{ backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 }}
              >
                {saving ? <ActivityIndicator color={Colors.text} /> : <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 16 }}>Save</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── SPLIT EDITOR MODAL ───────────────────────────────────────────────── */}
      <Modal visible={showSplitEditor} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 20, paddingVertical: 16,
            borderBottomWidth: 1, borderBottomColor: Colors.border,
          }}>
            <TouchableOpacity onPress={() => setShowSplitEditor(false)}>
              <Text style={{ color: Colors.textMuted, fontWeight: '600', fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800' }}>My Split</Text>
            <TouchableOpacity onPress={saveSplit} disabled={splitSaving}>
              {splitSaving
                ? <ActivityIndicator color={Colors.accent} size="small" />
                : <Text style={{ color: Colors.accent, fontWeight: '800', fontSize: 15 }}>Save</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="always">
            <Text style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
              Tap each day to set your session type. Coach references this every time you ask a training question.
            </Text>

            {/* Detected split label */}
            {Object.keys(editSplitSchedule).length > 0 && (
              <View style={{
                backgroundColor: Colors.accentDim, borderRadius: 12, padding: 14,
                borderWidth: 1, borderColor: Colors.accent + '40', alignItems: 'center',
              }}>
                <Text style={{ color: Colors.accent, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 }}>
                  {splitLabelFromSchedule(editSplitSchedule)}
                </Text>
                <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 4 }}>
                  {Object.keys(editSplitSchedule).length}x / week
                </Text>
              </View>
            )}

            {/* Day rows — Mon first */}
            {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
              const type = editSplitSchedule[dayIdx];
              const color = type ? (SESSION_COLORS[type] ?? Colors.textMuted) : Colors.textMuted;
              const exs = dayExercises[dayIdx] ?? [];
              return (
                <View key={dayIdx} style={{
                  backgroundColor: type ? color + '10' : Colors.surface,
                  borderRadius: 14,
                  borderWidth: 1, borderColor: type ? color + '40' : Colors.border,
                  overflow: 'hidden',
                }}>
                  {/* Day header row */}
                  <TouchableOpacity
                    onPress={() => pickDaySession(dayIdx)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }}
                  >
                    <View style={{
                      width: 40, height: 40, borderRadius: 8,
                      backgroundColor: type ? color + '20' : Colors.surface2,
                      borderWidth: 1, borderColor: type ? color + '50' : Colors.border,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {type ? (
                        <Text style={{ color, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' }}>
                          {type === 'Full Body' ? 'FB' : type === 'Upper' ? 'UP' : type === 'Lower' ? 'LO' : type.slice(0, 2).toUpperCase()}
                        </Text>
                      ) : (
                        <Text style={{ color: Colors.textMuted, fontSize: 16 }}>—</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800' }}>{DAY_FULL[dayIdx]}</Text>
                      <Text style={{ color: type ? color : Colors.textMuted, fontSize: 12, marginTop: 1, fontWeight: type ? '700' : '400' }}>
                        {type ?? 'Rest — tap to set'}
                      </Text>
                    </View>
                    <Text style={{ color: Colors.textMuted, fontSize: 18 }}>›</Text>
                  </TouchableOpacity>

                  {/* Inline exercise editor — no modal needed */}
                  {type && (
                    <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                      {/* Added exercises as removable chips */}
                      {exs.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {exs.map((ex, i) => (
                            <TouchableOpacity
                              key={ex.id}
                              onPress={() => setDayExercises(prev => ({
                                ...prev,
                                [dayIdx]: (prev[dayIdx] ?? []).filter((_, idx) => idx !== i),
                              }))}
                              style={{
                                backgroundColor: color + '20', borderRadius: 8,
                                paddingHorizontal: 10, paddingVertical: 5,
                                flexDirection: 'row', alignItems: 'center', gap: 5,
                                borderWidth: 1, borderColor: color + '40',
                              }}
                            >
                              <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{ex.name}</Text>
                              <Text style={{ color: Colors.textMuted, fontSize: 11 }}>×</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {/* Always-visible search — no expand/collapse friction */}
                      <TextInput
                        value={expandedDayEx === dayIdx ? splitExSearch : ''}
                        onFocus={() => { setExpandedDayEx(dayIdx); setSplitExSearch(''); }}
                        onChangeText={setSplitExSearch}
                        placeholder={exs.length > 0 ? '+ Add more...' : '+ Add exercises for this day'}
                        placeholderTextColor={color + '90'}
                        style={{
                          backgroundColor: color + '10', borderRadius: 8,
                          paddingHorizontal: 12, paddingVertical: 8,
                          color: Colors.text, fontSize: 13,
                          borderWidth: 1, borderColor: color + '30',
                        }}
                      />
                      {/* Results — only when this day is expanded and has text */}
                      {expandedDayEx === dayIdx && splitExSearch.length > 0 && (() => {
                        const q = splitExSearch.toLowerCase().trim();
                        const words = q.split(' ').filter(w => w.length > 1);
                        const scored = allExercises
                          .filter(e => !exs.some(x => x.id === e.id))
                          .map(e => {
                            const nameL = e.name.toLowerCase();
                            const muscleL = (e.muscle_group ?? '').toLowerCase();
                            let score = 0;
                            if (nameL === q) score = 100;                          // exact
                            else if (nameL.startsWith(q)) score = 90;             // starts with
                            else if (nameL.includes(q)) score = 80;               // substring
                            else {
                              const nameMatches = words.filter(w => nameL.includes(w)).length;
                              const muscleMatches = words.filter(w => muscleL.includes(w)).length;
                              // Require at least one name word to match (not just muscle)
                              if (nameMatches > 0) score = 40 + nameMatches * 10 + muscleMatches * 5;
                            }
                            return { e, score };
                          })
                          .filter(x => x.score > 0)
                          .sort((a, b) => b.score - a.score);
                        const results = scored.slice(0, 8).map(x => x.e);
                        if (results.length === 0) return (
                          <Text style={{ color: Colors.textMuted, fontSize: 12, paddingVertical: 4 }}>No matches</Text>
                        );
                        return (
                          <View style={{ borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border }}>
                            {results.map((ex, ri) => (
                              <TouchableOpacity
                                key={ex.id}
                                onPress={() => {
                                  setDayExercises(prev => ({
                                    ...prev,
                                    [dayIdx]: [...(prev[dayIdx] ?? []), { id: ex.id, name: ex.name, muscle_group: ex.muscle_group }],
                                  }));
                                  // Don't clear search — keep results visible for quick multi-add
                                }}
                                style={{
                                  flexDirection: 'row', alignItems: 'center', gap: 8,
                                  paddingVertical: 10, paddingHorizontal: 12,
                                  backgroundColor: Colors.surface,
                                  borderBottomWidth: ri < results.length - 1 ? 1 : 0,
                                  borderBottomColor: Colors.border,
                                }}
                              >
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
                                <Text style={{ color: Colors.text, fontSize: 13, flex: 1 }}>{ex.name}</Text>
                                <Text style={{ color: Colors.textMuted, fontSize: 11 }}>{ex.muscle_group}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        );
                      })()}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>


      {/* ── LIFTER DNA MODAL ─────────────────────────────────────────────────── */}
      <Modal visible={dnaModalOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: 20, paddingVertical: 16,
              borderBottomWidth: 1, borderBottomColor: Colors.border,
            }}>
              <View>
                <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '800' }}>Lifter DNA</Text>
                <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>Coach reads this before every response</Text>
              </View>
              <TouchableOpacity onPress={() => setDnaModalOpen(false)}>
                <Text style={{ color: Colors.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
              <Text style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
                Training history, injuries, what works for you, weak points, goals, lifestyle. The more detail, the more personalized Coach gets.
              </Text>
              <TextInput
                value={dnaText}
                onChangeText={setDnaText}
                multiline
                autoFocus
                placeholder="Start writing..."
                placeholderTextColor={Colors.textMuted}
                style={{
                  backgroundColor: Colors.surface, borderRadius: 14,
                  padding: 16, color: Colors.text, fontSize: 14,
                  minHeight: 220, textAlignVertical: 'top',
                  borderWidth: 1, borderColor: Colors.border, lineHeight: 22,
                }}
              />
              <TouchableOpacity
                onPress={saveDNA}
                disabled={dnaSaving}
                style={{ backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
              >
                {dnaSaving ? <ActivityIndicator color={Colors.text} /> : <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 15 }}>Save</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
