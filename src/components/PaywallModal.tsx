import { useState, useEffect } from 'react';
import {
  View, TouchableOpacity, Modal, ScrollView, StyleSheet,
  Alert, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Hit, Radius, Spacing, onColor } from '@/constants/theme';
import { AppText, Button, IconSymbol } from '@/components/ui';
import { RANK_TIERS } from '@/constants/ranks';
import { useWorld } from '@/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// RevenueCat product IDs — must be AUTO-RENEWABLE SUBSCRIPTIONS in App Store
// Connect (one subscription group), attached to RC entitlement "pro" and the
// current offering's monthly/annual packages.
const PRODUCT_IDS = {
  monthly: 'str.pros.monthly',  // $7.99/month auto-renewing
  annual: 'str.pros.annual',    // $59.99/year auto-renewing
};

// Required functional links on subscription paywalls (Guideline 3.1.2)
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
// Set to the same privacy policy URL used in App Store Connect
const PRIVACY_URL = 'https://blush-fiber-9a2.notion.site/STR-App-Privacy-Policy-28b1cd85d16f47b4aa026f1759d88c22';

interface Props {
  visible: boolean;
  onClose: () => void;
  reason?: string; // what triggered the paywall
}

const FREE_FEATURES = [
  'Unlimited workout logging',
  'Full exercise library',
  'PR tracking & strength tiers',
  'Physique rank (SBD)',
  'Unlimited friends & social feed',
  '5 AI coach messages per week',
  'Workout history (last 90 days)',
];

// Only what Pro actually gates. (Lifter DNA and imports are free for
// everyone; there is no separate "priority" AI tier — don't list them.)
const PRO_FEATURES = [
  { label: 'Unlimited AI Coach', sub: 'Free plan: 5 questions a week' },
  { label: 'Unlimited monthly analysis', sub: 'Free plan: one a month' },
  { label: 'Full workout history', sub: 'Every session, forever' },
  { label: 'Workout export', sub: 'CSV of every set you’ve logged' },
];

export function PaywallModal({ visible, onClose, reason }: Props) {
  const world = useWorld();
  const { user, refreshProfile } = useAuth();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [rcAvailable, setRcAvailable] = useState(false);

  // Our own restore mechanism (3.1.1): RevenueCat re-syncs the receipt, then
  // the server re-derives is_pro from the entitlement — works for the same
  // Apple ID on a new device or reinstall.
  const handleRestore = async () => {
    if (!rcAvailable || restoring) return;
    setRestoring(true);
    try {
      const Purchases = require('react-native-purchases').default;
      const customerInfo = await Purchases.restorePurchases();
      await supabase.functions.invoke('verify-subscription');
      await refreshProfile();
      const active = customerInfo.entitlements.active['pro'] !== undefined;
      Alert.alert(
        active ? 'Pro restored' : 'No purchases found',
        active
          ? 'Your Pro access is back. Welcome home.'
          : 'No previous Pro purchase found for this Apple ID.'
      );
      if (active) onClose();
    } catch (e: any) {
      Alert.alert('Restore failed', e.message ?? 'Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  useEffect(() => {
    // Check if RevenueCat is available (dev build only, not Expo Go)
    try {
      require('react-native-purchases');
      setRcAvailable(true);
    } catch {
      setRcAvailable(false);
    }
  }, []);

  const handlePurchase = async () => {
    if (!user) return;

    if (!rcAvailable) {
      // In Expo Go — show setup instructions
      Alert.alert(
        'Pro',
        'In-app purchases require the full app build. Build with EAS and configure RevenueCat to enable purchases.',
        [{ text: 'OK' }]
      );
      return;
    }

    setPurchasing(true);
    try {
      const Purchases = require('react-native-purchases').default;
      const offerings = await Purchases.getOfferings();
      const pkg = billingPeriod === 'annual'
        ? offerings.current?.annual
        : offerings.current?.monthly;

      if (!pkg) throw new Error('Product not found. Make sure App Store products are configured.');

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const isProNow = customerInfo.entitlements.active['pro'] !== undefined;

      if (isProNow) {
        // Server-side verification is the only writer of is_pro (protected by
        // the 018 trigger — a direct client write would be rejected anyway).
        // RevenueCat has the purchase either way; retry once, then tell the
        // user Restore will finish the job if the network hiccuped.
        let { error: fnErr } = await supabase.functions.invoke('verify-subscription');
        if (fnErr) ({ error: fnErr } = await supabase.functions.invoke('verify-subscription'));
        await refreshProfile();
        if (fnErr) {
          Alert.alert(
            'Purchase received',
            'Your purchase went through. If Pro doesn\'t activate in the next minute, tap "Restore Purchases" below.'
          );
        } else {
          Alert.alert('Welcome to STR Pro', 'You now have unlimited access.');
          onClose();
        }
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase failed', e.message);
      }
    } finally {
      setPurchasing(false);
    }
  };

  // Restyle only — purchase / restore / RevenueCat logic above is unchanged.
  // Stays an iOS pageSheet: it's the reviewed subscription flow.
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" allowSwipeDismissal onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.body}>
          <TouchableOpacity onPress={onClose} style={styles.close} accessibilityLabel="Close">
            <IconSymbol name="close" size={20} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.head}>
            <AppText variant="display">STR Pro</AppText>
            <AppText variant="body" style={styles.center}>{reason ?? 'Unlock the full training experience.'}</AppText>
          </View>

          <View style={styles.worlds}>
            {RANK_TIERS.map(t => <View key={t.key} style={[styles.world, { backgroundColor: t.color }]} />)}
          </View>

          <View style={styles.features}>
            {PRO_FEATURES.map((f, i) => (
              <View key={i} style={styles.feature}>
                <IconSymbol name="checkCircle" size={20} color={world.aura} />
                <View style={styles.flex}>
                  <AppText variant="heading">{f.label}</AppText>
                  <AppText variant="caption">{f.sub}</AppText>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.toggle}>
            {(['annual', 'monthly'] as const).map(period => {
              const on = billingPeriod === period;
              return (
                <TouchableOpacity
                  key={period}
                  onPress={() => setBillingPeriod(period)}
                  style={[styles.period, on && { backgroundColor: world.aura }]}
                  accessibilityState={{ selected: on }}
                >
                  <AppText variant="heading" color={on ? onColor(world.aura) : Colors.text}>{period === 'annual' ? 'Annual' : 'Monthly'}</AppText>
                  <AppText variant="caption" color={on ? onColor(world.aura) : Colors.textMuted}>
                    {period === 'annual' ? '$59.99 / year · save 37%' : '$7.99 / month'}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>

          <AppText variant="caption" style={styles.center}>
            {billingPeriod === 'annual' ? '$59.99 per year · auto-renews annually' : '$7.99 per month · auto-renews monthly'}
          </AppText>

          <Button label="Start Pro" size="lg" fullWidth loading={purchasing} onPress={handlePurchase} haptic="medium" />

          <View style={styles.links}>
            <TouchableOpacity onPress={handleRestore} disabled={restoring} style={styles.link}>
              <AppText variant="label" color={world.aura}>{restoring ? 'Restoring…' : 'Restore purchases'}</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.link}
              onPress={async () => {
                try {
                  const Purchases = require('react-native-purchases').default;
                  await Purchases.presentCodeRedemptionSheet();
                } catch {}
              }}
            >
              <AppText variant="label" color={world.aura}>Redeem code</AppText>
            </TouchableOpacity>
          </View>
          <AppText variant="caption" style={styles.center}>
            Payment is charged to your Apple Account at confirmation of purchase. The subscription auto-renews unless
            canceled at least 24 hours before the end of the current period. Manage or cancel anytime in Settings →
            Apple Account → Subscriptions.
          </AppText>
          <View style={styles.links}>
            <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)} style={styles.link}>
              <AppText variant="caption" style={styles.underline}>Terms of Use</AppText>
            </TouchableOpacity>
            {!!PRIVACY_URL && (
              <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)} style={styles.link}>
                <AppText variant="caption" style={styles.underline}>Privacy Policy</AppText>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  body: { padding: Spacing.xl, paddingBottom: 48, gap: Spacing.xl },
  close: { alignSelf: 'flex-end', width: Hit.min, height: Hit.min, alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', gap: Spacing.sm },
  center: { textAlign: 'center' },
  worlds: { flexDirection: 'row', gap: 4 },
  world: { flex: 1, height: 6 },
  features: { gap: Spacing.md },
  feature: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1, gap: 2 },
  toggle: { flexDirection: 'row', gap: Spacing.sm },
  period: {
    flex: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing.md, minHeight: 64, justifyContent: 'center',
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  links: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl },
  link: { minHeight: Hit.min, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
