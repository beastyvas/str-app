import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppText, Button, EmptyState, IconSymbol } from '@/components/ui';
import { PaywallModal } from '@/components/PaywallModal';
import { useWorld } from '@/theme';
import { exportWorkoutHistory } from '@/lib/exportWorkouts';
import { fmtVolume, unitFromProfile } from '@/lib/units';
import { HeatStrip } from '@/components/history/HeatStrip';
import { WorkoutDetailSheet } from '@/components/history/WorkoutDetailSheet';
import { ExerciseProgressSheet } from '@/components/history/ExerciseProgressSheet';
import { useHistory } from '@/components/history/useHistory';
import { formatDay, formatDuration, groupByWeek, type HistoryItem, type WorkoutData } from '@/components/history/historyData';

const HISTORY_PAYWALL = 'Pro unlocks your complete workout history — every session, forever.';
const EXPORT_PAYWALL = 'Pro exports your full workout history as a CSV — your data, anywhere.';

/** History: the 12-week heat strip, then one list grouped by week. */
export default function HistoryScreen() {
  const world = useWorld();
  const { isPro, canExport } = useSubscription();
  const { user, profile } = useAuth();
  const unit = unitFromProfile(profile?.unit_pref);
  const { workouts, loading, refreshing, refresh, loadMore, remove } = useHistory(user?.id, unit, isPro);
  const [selected, setSelected] = useState<WorkoutData | null>(null);
  const [chart, setChart] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const items = useMemo(() => groupByWeek(workouts), [workouts]);

  const handleExport = async () => {
    if (!user) return;
    if (!canExport) { setPaywall(EXPORT_PAYWALL); return; }
    setExporting(true);
    try {
      const { workouts: count } = await exportWorkoutHistory(user.id);
      if (count === 0) Alert.alert('Nothing to export yet', 'Finish a workout and it will show up here.');
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const renderItem = useCallback(({ item }: { item: HistoryItem }) => {
    if (item.type === 'week') {
      return (
        <View style={styles.weekHead}>
          <AppText variant="heading">{item.label}</AppText>
          <AppText variant="caption">{item.count} workout{item.count === 1 ? '' : 's'} · {fmtVolume(item.volume, unit)}</AppText>
        </View>
      );
    }
    const w = item.workout;
    return (
      <TouchableOpacity
        onPress={() => setSelected(w)}
        style={[styles.row, item.first && styles.rowFirst, item.last && styles.rowLast, !item.first && styles.divider]}
        accessibilityRole="button"
      >
        <View style={styles.flex}>
          <AppText variant="heading" numberOfLines={1}>{w.name}</AppText>
          <AppText variant="caption">{formatDay(w.started_at)} · {formatDuration(w.duration_mins)}</AppText>
        </View>
        {w.pr_count > 0 && (
          <View style={[styles.pr, { backgroundColor: world.aura }]}>
            <AppText variant="label" color={Colors.bg}>{w.pr_count} PR{w.pr_count === 1 ? '' : 's'}</AppText>
          </View>
        )}
        <IconSymbol name="chevronRight" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  }, [unit, world.aura]);

  if (loading) {
    return <SafeAreaView style={styles.loading}><ActivityIndicator color={world.aura} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <FlashList
        data={items}
        keyExtractor={i => i.key}
        getItemType={i => i.type}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={world.aura} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <AppText variant="display" style={styles.flex}>History</AppText>
              <Button label="Export" icon="share" variant="ghost" size="sm" loading={exporting} onPress={handleExport} />
            </View>
            {workouts.length > 0
              ? <HeatStrip workouts={workouts} unit={unit} onSelect={setSelected} />
              : <EmptyState icon="calendar" title="No workouts yet" body="Finish your first workout and it lands here." />}
          </View>
        }
        ListFooterComponent={
          !isPro && workouts.length > 0 ? (
            <View style={styles.footer}>
              <AppText variant="caption">Showing the last 90 days.</AppText>
              <Button label="See full history with Pro" variant="tinted" size="sm" onPress={() => setPaywall(HISTORY_PAYWALL)} />
            </View>
          ) : null
        }
      />

      <WorkoutDetailSheet
        workout={selected}
        unit={unit}
        onClose={() => setSelected(null)}
        onOpenChart={name => { setSelected(null); setTimeout(() => setChart(name), 250); }}
        onDelete={w => remove(w.id)}
      />
      <ExerciseProgressSheet exercise={chart} workouts={workouts} unit={unit} onClose={() => setChart(null)} />
      <PaywallModal visible={!!paywall} onClose={() => setPaywall(null)} reason={paywall ?? ''} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  loading: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: Spacing.screenH, paddingBottom: 48 },
  header: { gap: Spacing.group, paddingTop: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, gap: 2 },
  weekHead: { paddingTop: Spacing.group, paddingBottom: Spacing.sm, gap: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 60, paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border,
  },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: Radius.lg },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  pr: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  footer: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xl },
});
