import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/lib/supabase';
import { screenText } from '@/lib/contentFilter';
import { unitFromProfile } from '@/lib/units';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppText, Section } from '@/components/ui';
import { QRModal } from '@/components/QRModal';
import { TierLadderModal } from '@/components/TierLadderModal';
import { MuscleHeatmap } from '@/components/MuscleHeatmap';
import { PaywallModal } from '@/components/PaywallModal';
import { PowerBreakdown } from '@/components/power/PowerBreakdown';
import { WorldLadder } from '@/components/power/WorldLadder';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { useProfileStats } from '@/components/profile/useProfileStats';
import { CastGallery } from '@/components/profile/CastGallery';
import { CameoSettings } from '@/components/profile/CameoSettings';
import { AppearanceSection } from '@/components/profile/AppearanceSection';
import { TrainingProfile } from '@/components/profile/TrainingProfile';
import { AccountSection } from '@/components/profile/AccountSection';
import { KnownMaxSheet } from '@/components/profile/KnownMaxSheet';
import { EditProfileSheet } from '@/components/profile/EditProfileSheet';
import { DnaSheet } from '@/components/profile/DnaSheet';
import { SplitEditorSheet, splitLabelFromSchedule } from '@/components/profile/SplitEditorSheet';

type Sheet = 'edit' | 'dna' | 'split' | 'max' | 'qr' | 'ladder' | 'paywall' | null;

/**
 * Profile. Hero: avatar, name, Power Level, rank chip. Then: where the number
 * comes from (+ Set a known max), the world ladder, the cast, appearance,
 * training profile, cameo switches, and account settings.
 */
export default function ProfileScreen() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const { isPro } = useSubscription();
  const unit = unitFromProfile(profile?.unit_pref);
  const { stats, reload } = useProfileStats(user?.id, profile);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [uploading, setUploading] = useState(false);
  const close = () => setSheet(null);
  const firstName = profile?.display_name?.split(' ')[0] ?? 'lifter';
  const power = stats?.power ?? null;
  const rank = power && power.confidence !== 'calibrating' ? power.rank : null;

  const uploadPhoto = async (uri: string) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
      const fileName = `${user.id}.${ext}`;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const { error } = await supabase.storage.from('avatars').upload(fileName, bytes, { upsert: true, contentType: `image/${ext}` });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('users').update({ avatar_url: `${data.publicUrl}?t=${Date.now()}` }).eq('id', user.id);
      await refreshProfile();
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const pickPhoto = () => {
    const launch = async (camera: boolean) => {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed'); return; }
      const opts = { allowsEditing: true, aspect: [1, 1] as [number, number], quality: 0.7 };
      const r = camera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync({ ...opts, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      if (!r.canceled && r.assets[0]) uploadPhoto(r.assets[0].uri);
    };
    Alert.alert('Profile photo', undefined, [
      { text: 'Take photo', onPress: () => launch(true) },
      { text: 'Choose from library', onPress: () => launch(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const saveBio = async (bio: string) => {
    if (!user) return;
    const issue = screenText(bio, 'bio');
    if (issue) { Alert.alert('Not allowed', issue); return; }
    await supabase.from('users').update({ bio: bio.trim() || null }).eq('id', user.id);
    await refreshProfile();
  };

  const schedule = (profile?.split_schedule ?? null) as Record<string, string> | null;
  const splitLabel = profile?.split_type
    ?? (schedule && Object.keys(schedule).length
      ? splitLabelFromSchedule(Object.fromEntries(Object.entries(schedule).map(([k, v]) => [Number(k), v])))
      : null);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProfileHero
          name={profile?.display_name ?? user?.email ?? 'You'}
          username={profile?.username}
          avatarUrl={profile?.avatar_url}
          badges={{ isPro: profile?.is_pro, isOwner: profile?.is_owner, isOg: profile?.is_og }}
          bio={profile?.bio}
          power={power}
          stats={stats ? { workouts: stats.totalWorkouts, volume: stats.totalVolume, streak: stats.streakDays, friends: stats.friendCount } : null}
          unit={unit}
          uploading={uploading}
          onAvatar={pickPhoto}
          onSaveBio={saveBio}
          onOpenLadder={() => setSheet('ladder')}
          onShowQR={() => setSheet('qr')}
        />

        {power && <PowerBreakdown reading={power} unit={unit} onSetKnownMax={() => setSheet('max')} />}

        <Section title="Rank ladder" action={{ label: 'Thresholds', onPress: () => setSheet('ladder') }}>
          <WorldLadder result={rank} bodyweightLbs={profile?.bodyweight_lbs ?? 185} gender={profile?.gender} unit={unit} />
        </Section>

        <CastGallery name={firstName} />
        <AppearanceSection />

        {user && (
          <TrainingProfile
            userId={user.id}
            goal={profile?.primary_goal}
            style={profile?.training_style}
            dna={profile?.training_notes}
            onEditDna={() => setSheet('dna')}
            splitLabel={splitLabel}
            onEditSplit={() => setSheet('split')}
            onSaved={refreshProfile}
          />
        )}

        {stats && Object.keys(stats.muscleVolume).length > 0 && (
          <Section title="Last 30 days">
            <AppText variant="caption">Sets by muscle — spot what's overcooked and what's skipped.</AppText>
            <View style={styles.heatmap}><MuscleHeatmap volumeByGroup={stats.muscleVolume} /></View>
          </Section>
        )}

        <CameoSettings />

        {user && (
          <AccountSection
            userId={user.id}
            profile={profile}
            isPro={isPro}
            onEditProfile={() => setSheet('edit')}
            onShowPaywall={() => setSheet('paywall')}
            onRefreshProfile={refreshProfile}
            onSignOut={signOut}
          />
        )}
      </ScrollView>

      <TierLadderModal visible={sheet === 'ladder'} onClose={close} result={rank} bodyweightLbs={profile?.bodyweight_lbs ?? 185} gender={profile?.gender} />
      <PaywallModal visible={sheet === 'paywall'} onClose={close} reason="Unlock unlimited AI Coach, full workout history, and more." />
      {user && (
        <>
          <QRModal
            visible={sheet === 'qr'}
            userId={user.id}
            username={profile?.username ?? undefined}
            displayName={profile?.display_name ?? 'Athlete'}
            tierLabel={rank?.tier.label}
            tierColor={rank?.tier.color}
            onClose={close}
          />
          <KnownMaxSheet visible={sheet === 'max'} userId={user.id} unit={unit} onClose={close} onSaved={reload} />
          <EditProfileSheet visible={sheet === 'edit'} profile={profile} userId={user.id} onClose={close} onSaved={refreshProfile} />
          <DnaSheet visible={sheet === 'dna'} userId={user.id} initial={profile?.training_notes} onClose={close} onSaved={refreshProfile} />
          <SplitEditorSheet visible={sheet === 'split'} userId={user.id} schedule={schedule} onClose={close} onSaved={refreshProfile} />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.screenH, paddingBottom: 60, gap: Spacing.group },
  heatmap: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.lg },
});
