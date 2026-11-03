import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { AppText, Button, Section } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { supabase } from '@/lib/supabase';
import type { UserRow } from '@/lib/database.types';

interface Props {
  profile: UserRow | null;
  isPro: boolean;
  tierKey: string;
  subTier: number;
  onRefreshProfile: () => void;
  onPaywall: () => void;
}

/** 30-day deep dive. Free: one per calendar month (mirrors the server check). */
export function MonthlyAnalysis({ profile, isPro, tierKey, subTier, onRefreshProfile, onPaywall }: Props) {
  const world = useWorld();
  const p = profile as any;
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  // Hydrate the last saved report (persisted server-side)
  useEffect(() => {
    if (p?.monthly_analysis_last_report && report === null) {
      setReport(p.monthly_analysis_last_report);
      setLastRun(p.monthly_analysis_last_run ?? null);
    }
  }, [profile]);

  const usedThisMonth = (() => {
    if (!p?.monthly_analysis_month_start) return false;
    const d = new Date(p.monthly_analysis_month_start);
    const now = new Date();
    return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth() && (p.monthly_analysis_count ?? 0) >= 1;
  })();
  const canRun = isPro || !usedThisMonth;

  const run = async () => {
    if (loading) return;
    if (!canRun) { onPaywall(); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('monthly-analysis', { body: { tierKey, subTier } });
      if (error) {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const payload = await ctx.json();
            if (payload?.error === 'limit') { onPaywall(); return; }
            Alert.alert('Monthly analysis', payload?.message ?? 'Could not generate your analysis.');
            return;
          } catch {}
        }
        Alert.alert('Monthly analysis', 'Could not generate your analysis. Try again.');
        return;
      }
      if (data?.error) {
        if (data.error === 'limit') { onPaywall(); return; }
        Alert.alert('Monthly analysis', data.message ?? 'Could not generate your analysis.');
        return;
      }
      setReport(data.report);
      setLastRun(data.lastRun);
      onRefreshProfile();
    } catch {
      Alert.alert('Monthly analysis', 'Could not reach the analyzer. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section title="Monthly analysis">
      <AppText variant="body">
        Your last 30 days: volume balance, RPE creep, stalled lifts, and themes in your notes.
      </AppText>
      {!isPro && <AppText variant="caption">{usedThisMonth ? "You've used this month's free analysis." : 'Free plan: one analysis a month.'}</AppText>}
      {report && (
        <View style={[styles.report, { borderLeftColor: world.aura }]}>
          {lastRun && <AppText variant="caption">{new Date(lastRun).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</AppText>}
          <AppText variant="body" color={Colors.text}>{report}</AppText>
        </View>
      )}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={world.aura} />
          <AppText variant="caption">Reading your last 30 days</AppText>
        </View>
      ) : canRun ? (
        <Button label={report ? 'Run a new analysis' : 'Generate analysis'} onPress={run} fullWidth size="lg" />
      ) : (
        <Button label="Go Pro for unlimited analyses" variant="tinted" onPress={onPaywall} fullWidth />
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  report: { backgroundColor: Colors.surface, borderLeftWidth: 3, borderRadius: Radius.sm, padding: Spacing.lg, gap: Spacing.sm },
  loading: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
});
