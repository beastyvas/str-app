import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// RevenueCat product IDs — configure these in App Store Connect + RC dashboard
const PRODUCT_IDS = {
  monthly: 'str.pro.monthly',  // $7.99/month
  annual: 'str.pro.annual',    // $59.99/year
};

interface Props {
  visible: boolean;
  onClose: () => void;
  reason?: string; // what triggered the paywall
}

const FREE_FEATURES = [
  'Unlimited workout logging',
  'Full exercise library',
  'PR tracking & strength tiers',
  'Anime physique rank (SBD)',
  'Unlimited friends & social feed',
  '3 AI coach messages per week',
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
  const [rcAvailable, setRcAvailable] = useState(false);

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
        'Subscription',
        'In-app purchases require the full app build. Build with EAS and configure RevenueCat to enable subscriptions.',
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
        await supabase.from('users').update({ is_pro: true }).eq('id', user.id);
        await refreshProfile();
        Alert.alert('Welcome to STR Pro! 🏆', 'You now have unlimited access.');
        onClose();
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase failed', e.message);
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!rcAvailable || !user) return;
    setPurchasing(true);
    try {
      const Purchases = require('react-native-purchases').default;
      const customerInfo = await Purchases.restorePurchases();
      const isProNow = customerInfo.entitlements.active['pro'] !== undefined;
      if (isProNow) {
        await supabase.from('users').update({ is_pro: true }).eq('id', user.id);
        await refreshProfile();
        Alert.alert('Restored!', 'Your Pro subscription is active.');
        onClose();
      } else {
        Alert.alert('No subscription found', 'No active Pro subscription on this Apple ID.');
      }
    } catch (e: any) {
      Alert.alert('Restore failed', e.message);
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
            <Text style={{ color: Colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -1, textAlign: 'center' }}>
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
              {['NINJA', 'GRAPPLER', 'BLACK\nSWORDSMAN', 'HOLLOW', 'SOLO', 'FREEDOM'].map((tier, i) => {
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
                    <Text style={{ color: colors[i], fontSize: 7, fontWeight: '900', textAlign: 'center' }}>
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
                  {period === 'annual' ? '$59.99 / yr' : '$7.99 / mo'}
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
                ? '$4.99/month, billed annually'
                : '$7.99/month, cancel anytime'}
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
              : <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 17, letterSpacing: 0.3 }}>
                  Start Pro →
                </Text>
            }
          </TouchableOpacity>

          {/* Restore + legal */}
          <TouchableOpacity onPress={handleRestore} style={{ alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Restore purchases</Text>
          </TouchableOpacity>
          <Text style={{ color: Colors.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 15 }}>
            Subscription auto-renews. Cancel anytime in App Store settings.
            Payment charged to your Apple ID.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
