import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { exportWorkoutHistory } from '@/lib/exportWorkouts';
import { useSubscription } from '@/hooks/useSubscription';
import { SettingsGroup, SettingsRow } from './SettingsList';
import type { UserRow } from '@/lib/database.types';

interface Props {
  userId: string;
  profile: UserRow | null;
  isPro: boolean;
  onEditProfile: () => void;
  onShowPaywall: () => void;
  onRefreshProfile: () => void;
  onSignOut: () => Promise<void> | void;
}

/** Units, bodyweight, export, subscription, privacy, sign out, delete. */
export function AccountSection({ userId, profile, isPro, onEditProfile, onShowPaywall, onRefreshProfile, onSignOut }: Props) {
  const router = useRouter();
  const { canExport } = useSubscription();
  const [exporting, setExporting] = useState(false);
  const isPublic = (profile as any)?.profile_public ?? true;
  const bw = profile?.bodyweight_lbs
    ? profile.unit_pref === 'kg' ? `${(profile.bodyweight_lbs / 2.2046226218).toFixed(1)} kg` : `${profile.bodyweight_lbs} lbs`
    : '—';

  const exportHistory = async () => {
    if (!canExport) { onShowPaywall(); return; }
    setExporting(true);
    try {
      const { workouts } = await exportWorkoutHistory(userId);
      if (workouts === 0) Alert.alert('Nothing to export yet', 'Finish a workout and it will show up here.');
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const redeem = async () => {
    try {
      const Purchases = require('react-native-purchases').default;
      await Purchases.presentCodeRedemptionSheet();
    } catch {}
  };

  const confirmDelete = () => Alert.alert(
    'Delete account',
    'This permanently deletes your account, workouts, PRs and data. It cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete my account', style: 'destructive', onPress: () => Alert.alert('Are you sure?', 'Your entire training history will be lost.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete everything', style: 'destructive', onPress: async () => {
              try {
                const { error } = await supabase.rpc('delete_user');
                if (error) throw error;
                await onSignOut();
              } catch (e: any) {
                Alert.alert('Error', e.message ?? 'Could not delete account.');
              }
            },
          },
        ]),
      },
    ],
  );

  return (
    <>
      <SettingsGroup title="Account">
        <SettingsRow first label="Profile details" value={profile?.display_name ?? undefined} onPress={onEditProfile} />
        <SettingsRow label="Units" value={profile?.unit_pref ?? 'lbs'} onPress={onEditProfile} />
        <SettingsRow label="Bodyweight" value={bw} onPress={onEditProfile} />
        <SettingsRow label={exporting ? 'Exporting…' : 'Export history (CSV)'} value={canExport ? undefined : 'Pro'} onPress={exportHistory} />
        <SettingsRow
          label="Public profile"
          sub="Off = your posts and PRs are friends only"
          toggle={{
            value: isPublic,
            onChange: async next => {
              await supabase.from('users').update({ profile_public: next } as any).eq('id', userId);
              onRefreshProfile();
            },
          }}
        />
      </SettingsGroup>

      <SettingsGroup title="Subscription">
        <SettingsRow
          first
          label={isPro ? 'STR Pro' : 'Free plan'}
          sub={isPro ? 'Unlimited coach · full history' : 'Unlimited coach, full history, export'}
          value={isPro ? 'Active' : 'Upgrade'}
          onPress={isPro ? undefined : onShowPaywall}
        />
        {!isPro && <SettingsRow label="Redeem a code" onPress={redeem} />}
      </SettingsGroup>

      <SettingsGroup>
        {__DEV__ && <SettingsRow first label="World preview (dev)" onPress={() => router.push('/dev/worlds' as any)} />}
        <SettingsRow first={!__DEV__} label="Sign out" destructive onPress={onSignOut} />
        <SettingsRow label="Delete account" destructive onPress={confirmDelete} />
      </SettingsGroup>
    </>
  );
}
