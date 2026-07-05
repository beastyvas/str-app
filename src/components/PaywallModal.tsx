import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  ActivityIndicator, Alert, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
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
const PRIVACY_URL = '';

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

const PRO_FEATURES = [
  { label: 'Unlimited AI Coach', sub: 'Ask anything, anytime' },
  { label: 'Full workout history', sub: 'Every session, forever' },
  { label: 'Lifter DNA', sub: 'Coach learns who you are' },
  { label: 'Unlimited log imports', sub: 'Migrate all your old data' },
  { label: 'Workout export', sub: 'CSV + PDF' },
  { label: 'Priority AI responses', sub: 'Longer, deeper analysis' },
];

export function PaywallModal({ visible, onClose, reason }: Props) {
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
        active ? 'Pro restored 🏆' : 'No purchases found',
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
          Alert.alert('Welcome to STR Pro! 🏆', 'You now have unlimited access.');
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
          {/* Close */}
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            style={{
              alignSelf: 'flex-end', marginBottom: 8,
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: Colors.surface2,
              borderWidth: 1, borderColor: Colors.border,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: Colors.textMuted, fontSize: 18 }}>×</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <Text style={{ color: Colors.accent, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>
              Upgrade
            </Text>
            <Text style={{ color: Colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -1, textAlign: 'center' }}>
              STR Pro
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
              {reason ?? 'Unlock the full training experience.'}
            </Text>
          </View>

          {/* Tier progression visual */}
          <View style={{
            backgroundColor: Colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: Colors.border,
          }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
              Your rank progression unlocked
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {['MORTAL', 'AWAKENED', 'ASCENDANT', 'PHANTOM', 'SOVEREIGN', 'GODHAND'].map((tier, i) => {
                const colors = ['#CD7F32', '#A67C52', '#A8A9AD', '#FFB800', '#9B8FFF', '#B9F2FF'];
                return (
                  <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                    <View style={{
                      width: 28, height: 28, borderRadius: 14,
                      backgroundColor: colors[i] + '20',
                      borderWidth: 1.5,
                      borderColor: colors[i] + '60',
                      marginBottom: 4,
                    }} />
                    <Text style={{ color: colors[i], fontSize: 7, fontWeight: '800', textAlign: 'center' }}>
                      {tier}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Pro features */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
              Everything in Pro
            </Text>
            {PRO_FEATURES.map((f, i) => (
              <View key={i} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                marginBottom: 12,
              }}>
                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: Colors.accent + '20',
                  borderWidth: 1, borderColor: Colors.accent + '40',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: Colors.accent, fontSize: 14 }}>✓</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{f.label}</Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 1 }}>{f.sub}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Billing toggle */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: Colors.surface,
            borderRadius: 12,
            padding: 4,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: Colors.border,
          }}>
            {(['annual', 'monthly'] as const).map(period => (
              <TouchableOpacity
                key={period}
                onPress={() => setBillingPeriod(period)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 9,
                  alignItems: 'center',
                  backgroundColor: billingPeriod === period ? Colors.accent : 'transparent',
                }}
              >
                <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 13 }}>
                  {period === 'annual' ? 'Annual' : 'Monthly'}
                </Text>
                <Text style={{
                  color: billingPeriod === period ? Colors.text : Colors.textMuted,
                  fontSize: 11, marginTop: 1,
                }}>
                  {period === 'annual' ? '$59.99 / year' : '$7.99 / month'}
                </Text>
                {period === 'annual' && (
                  <View style={{
                    backgroundColor: Colors.success + '20',
                    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, marginTop: 3,
                  }}>
                    <Text style={{ color: Colors.success, fontSize: 9, fontWeight: '800' }}>SAVE 37%</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Price callout */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: Colors.textMuted, fontSize: 13 }}>
              {billingPeriod === 'annual'
                ? '$59.99 per year · auto-renews annually'
                : '$7.99 per month · auto-renews monthly'}
            </Text>
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={handlePurchase}
            disabled={purchasing}
            style={{
              backgroundColor: Colors.accent,
              borderRadius: 16,
              paddingVertical: 18,
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            {purchasing
              ? <ActivityIndicator color={Colors.text} />
              : <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 17, letterSpacing: 0.3 }}>
                  Start Pro →
                </Text>
            }
          </TouchableOpacity>

          {/* Restore / Redeem */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
            <TouchableOpacity onPress={handleRestore} disabled={restoring}>
              <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700' }}>
                {restoring ? 'Restoring…' : 'Restore Purchases'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => {
              try {
                const Purchases = require('react-native-purchases').default;
                await Purchases.presentCodeRedemptionSheet();
              } catch {}
            }}>
              <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700' }}>Redeem Code</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: Colors.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 15 }}>
            Payment is charged to your Apple Account at confirmation of purchase.
            The subscription auto-renews unless canceled at least 24 hours before
            the end of the current period. Manage or cancel anytime in
            Settings → Apple Account → Subscriptions.
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 10 }}>
            <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
              <Text style={{ color: Colors.textMuted, fontSize: 11, textDecorationLine: 'underline' }}>Terms of Use</Text>
            </TouchableOpacity>
            {!!PRIVACY_URL && (
              <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
                <Text style={{ color: Colors.textMuted, fontSize: 11, textDecorationLine: 'underline' }}>Privacy Policy</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
