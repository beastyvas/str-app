import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Image,
  Dimensions,
} from 'react-native';
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
import { PaywallModal } from '@/components/PaywallModal';
import { useSubscription } from '@/hooks/useSubscription';
import { getTierForWeight, TIER_LABELS, TIER_ORDER, STRENGTH_STANDARDS } from '@/constants/strengthStandards';
import { getAnimeTierResult, ROMAN } from '@/constants/animeTiers';

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
      backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: Colors.border, marginBottom: 0,
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
  const [animeTier, setAnimeTier] = useState<ReturnType<typeof getAnimeTierResult> | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{ day: string; volume: number; duration: number; sets: number }[]>([]);

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
  const [sbdInputs, setSbdInputs] = useState({ sq: '', bp: '', dl: '' });
  const [sbdSaving, setSbdSaving] = useState(false);

  useEffect(() => {
    if (user) loadStats();
  }, [user, profile?.bodyweight_lbs]);

  const loadStats = async () => {
    if (!user) return;
    setLoadingStats(true);
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const [
        { data: workouts },
        { data: prs },
        { count: friends },
        { data: weekWorkouts },
      ] = await Promise.all([
        supabase.from('workouts').select('id, started_at').eq('user_id', user.id).not('ended_at', 'is', null),
        supabase.from('personal_records').select('weight, reps, achieved_at, exercises(name)').eq('user_id', user.id).order('achieved_at', { ascending: false }),
        supabase.from('friendships').select('id', { count: 'exact', head: true }).or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq('status', 'accepted'),
        supabase.from('workouts').select('started_at, ended_at, workout_sets(weight, reps)').eq('user_id', user.id).not('ended_at', 'is', null).gte('started_at', sevenDaysAgo),
      ]);

      setFriendCount(friends ?? 0);

      // Build weekly data (last 7 days Mon–Sun or actual days)
      const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      const dayMap: Record<string, { volume: number; duration: number; sets: number; isToday: boolean }> = {};
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.toDateString();
        const label = i === 0 ? 'Today' : dayNames[d.getDay()];
        dayMap[key] = { volume: 0, duration: 0, sets: 0, isToday: i === 0 };
        // store label by key
        (dayMap[key] as any).__label = label;
      }

      for (const w of weekWorkouts ?? []) {
        const key = new Date(w.started_at).toDateString();
        if (!dayMap[key]) continue;
        const sets: any[] = (w as any).workout_sets ?? [];
        dayMap[key].volume += sets.reduce((s: number, x: any) => s + (x.weight ?? 0) * (x.reps ?? 0), 0);
        dayMap[key].sets += sets.length;
        if (w.ended_at) {
          dayMap[key].duration += Math.round((new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000);
        }
      }

      const weekly = Object.entries(dayMap).map(([, v]) => ({
        day: (v as any).__label as string,
        volume: v.volume,
        duration: v.duration,
        sets: v.sets,
      }));
      setWeeklyData(weekly);

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
      setAnimeTier(getAnimeTierResult(sbdPRs, bw));

      const { data: volumeData } = await supabase
        .from('workout_sets')
        .select('weight, reps, workouts!inner(user_id)')
        .eq('workouts.user_id', user.id);

      const totalVolume = (volumeData ?? []).reduce((s: number, x: any) => s + x.weight * x.reps, 0);
      const totalSets = (volumeData ?? []).length;

      const groupMap: Record<string, { tier: TierName; bestLift: string; weight: number }> = {};
      for (const pr of allPRs) {
        const standard = STRENGTH_STANDARDS[pr.exerciseName.toLowerCase()];
        if (!standard || pr.tier === 'beginner') continue;
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

    if (uname && uname !== profile?.username) {
      const { data: existing } = await supabase.from('users').select('id').eq('username', uname).neq('id', user!.id).maybeSingle();
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
          weight: parseFloat(entry.val), reps: 1,
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

  const formatVolume = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
    return String(v);
  };

  const bwDisplay = profile?.unit_pref === 'kg' && profile.bodyweight_lbs
    ? `${(profile.bodyweight_lbs / 2.205).toFixed(1)} kg`
    : `${profile?.bodyweight_lbs ?? '—'} lbs`;

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const tierColor = animeTier?.animeTier.color ?? Colors.accent;

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
                  <Image source={{ uri: profile.avatar_url }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                ) : (
                  <Text style={{ color: tierColor, fontWeight: '900', fontSize: 26 }}>
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
              <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginBottom: 2 }}>
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
                  fontWeight: '900',
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

          {/* ── ANIME TIER CARD ──────────────────────────────────────────────── */}
          {animeTier && (
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
                    fontWeight: '900',
                    fontSize: 14,
                    letterSpacing: 2.5,
                    textTransform: 'uppercase',
                    textShadowColor: tierColor,
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 6,
                  }}>
                    {animeTier.animeTier.label} {ROMAN[animeTier.subTier]}
                  </Text>
                </View>
                <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                  {animeTier.avgScore > 0 ? `${animeTier.avgScore.toFixed(1)} / 5.0` : 'Set SBD to rank'}
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
                "{animeTier.animeTier.tagline}"
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
                    {animeTier.lifts.some(l => l.weight > 0) ? 'Update SBD' : 'Set SBD →'}
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
                { label: 'Volume', value: `${formatVolume(stats.totalVolume)} lbs`, color: null },
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
                    fontWeight: '900',
                    letterSpacing: -0.5,
                  }}>
                    {s.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* ── SBD TIERS ───────────────────────────────────────────────────── */}
          {animeTier && animeTier.lifts.some(l => l.weight > 0) && (
            <View style={{ backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
              <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
                SBD Strength
              </Text>
              {animeTier.lifts.map((lift, i) => {
                const pct = Math.min(lift.tierScore / 5, 1);
                const hasData = lift.weight > 0;
                return (
                  <View key={i} style={{ marginBottom: i < 2 ? 12 : 0 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '800', width: 24 }}>{lift.label}</Text>
                        {hasData && <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>{lift.weight} lbs</Text>}
                      </View>
                      {hasData ? (
                        <View style={{ backgroundColor: TIER_COLORS[lift.tier] + '20', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ color: TIER_COLORS[lift.tier], fontSize: 10, fontWeight: '800' }}>{TIER_LABELS[lift.tier].toUpperCase()}</Text>
                        </View>
                      ) : (
                        <Text style={{ color: Colors.textMuted, fontSize: 11 }}>not logged</Text>
                      )}
                    </View>
                    <View style={{ height: 5, backgroundColor: Colors.surface2, borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{
                        height: '100%', width: `${(hasData ? pct : 0.02) * 100}%`,
                        backgroundColor: hasData ? TIER_COLORS[lift.tier] : Colors.border, borderRadius: 3,
                      }} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── BODY PART TIERS ─────────────────────────────────────────────── */}
          {stats && stats.muscleGroupTiers.length > 0 && (
            <View style={{ backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
              <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
                Body Part Ranks
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {stats.muscleGroupTiers.map((mg, i) => {
                  const tc = TIER_COLORS[mg.tier];
                  return (
                    <View key={i} style={{
                      width: '47%', backgroundColor: tc + '10', borderRadius: 12, padding: 12,
                      borderWidth: 1, borderColor: tc + '40', gap: 4,
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: Colors.textSecondary, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>{mg.group}</Text>
                        <View style={{ backgroundColor: tc + '25', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                          <Text style={{ color: tc, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>{TIER_LABELS[mg.tier].toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={{ color: Colors.textMuted, fontSize: 10 }} numberOfLines={1}>{mg.bestLift}</Text>
                      <Text style={{ color: tc, fontSize: 13, fontWeight: '800' }}>{mg.weight} lbs</Text>
                      <View style={{ height: 3, backgroundColor: Colors.surface2, borderRadius: 2, marginTop: 4 }}>
                        <View style={{ height: '100%', width: `${(TIER_ORDER.indexOf(mg.tier) / 5) * 100}%`, backgroundColor: tc, borderRadius: 2 }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── ALL EXERCISE PRs ─────────────────────────────────────────────── */}
          {stats && stats.allPRs.length > 0 && (
            <View style={{ backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
              <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
                All Lift PRs
              </Text>
              {stats.allPRs.map((pr, i) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: i < stats.allPRs.length - 1 ? 1 : 0,
                  borderBottomColor: Colors.border, gap: 10,
                }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TIER_COLORS[pr.tier], flexShrink: 0 }} />
                  <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>{pr.exerciseName}</Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
                    {pr.weight === 0 ? `BW×${pr.reps}` : `${pr.weight}×${pr.reps}`}
                  </Text>
                  <View style={{ backgroundColor: TIER_COLORS[pr.tier] + '18', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: TIER_COLORS[pr.tier], fontSize: 9, fontWeight: '800' }}>{TIER_LABELS[pr.tier].toUpperCase()}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

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
              <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '900' }}>
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
                <Text style={{ color: Colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>ACTIVE</Text>
              </View>
            ) : (
              <Text style={{ color: Colors.accent, fontSize: 13, fontWeight: '800' }}>Upgrade →</Text>
            )}
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
                                // Delete all user data — Supabase cascades handle most of it
                                await supabase.from('users').delete().eq('id', user.id);
                                // Delete auth user via edge function or RPC
                                await supabase.rpc('delete_user');
                                await signOut();
                              } catch (e: any) {
                                Alert.alert('Error', 'Could not delete account. Please contact support@str.app');
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
            <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Tier Ladder Modal */}
      <TierLadderModal visible={showTierLadder} onClose={() => setShowTierLadder(false)} result={animeTier} />

      {/* Paywall */}
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} reason="Unlock unlimited AI Coach, full workout history, and more." />

      {/* QR Modal */}
      {user && (
        <QRModal
          visible={showQR}
          userId={user.id}
          username={profile?.username ?? undefined}
          displayName={profile?.display_name ?? 'Athlete'}
          tierLabel={animeTier?.animeTier.label}
          tierColor={animeTier?.animeTier.color}
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
              <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '900' }}>Your SBD Maxes</Text>
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
                  {label} (lbs)
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
              {sbdSaving ? <ActivityIndicator color={Colors.text} /> : <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 16 }}>SAVE & UPDATE RANK</Text>}
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
              <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '900' }}>Edit Profile</Text>
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
                {saving ? <ActivityIndicator color={Colors.text} /> : <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 16 }}>Save</Text>}
              </TouchableOpacity>
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
                <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '900' }}>Lifter DNA</Text>
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
                {dnaSaving ? <ActivityIndicator color={Colors.text} /> : <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 15 }}>Save</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
