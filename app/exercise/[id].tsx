import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toDisplay, unitFromProfile, LBS_PER_KG, WeightUnit } from '@/lib/units';
import { Colors, Fonts, Hit, Radius, Spacing } from '@/constants/theme';
import { getTierForWeight, TIER_ORDER, getScaledThresholds } from '@/constants/strengthStandards';
import { RANK_TIERS } from '@/constants/ranks';
import { AppText, IconSymbol, Section } from '@/components/ui';
import { MangaPanel } from '@/components/anime';
import { useWorld } from '@/theme';
import { MuscleMap } from '@/components/MuscleMap';
import { ExerciseAnimation } from '@/components/ExerciseAnimation';

const SCREEN_WIDTH = Dimensions.get('window').width;
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** Est. 1RM per session — bars, latest in the aura. */
function E1rmBars({ data, unit, aura }: { data: { value: number }[]; unit: WeightUnit; aura: string }) {
  const h = 80;
  const min = Math.min(...data.map(d => d.value));
  const range = Math.max(...data.map(d => d.value)) - min || 1;
  const barW = Math.max(6, (SCREEN_WIDTH - 72) / data.length - 4);
  return (
    <Section title={`Est. 1RM, last ${data.length} sessions`}>
      <View style={styles.card}>
        <View style={[styles.bars, { height: h }]}>
          {data.map((d, i) => (
            <View key={i} style={styles.barCol}>
              <View style={{ width: barW, height: Math.max(4, ((d.value - min) / range) * h), backgroundColor: i === data.length - 1 ? aura : aura + '55' }} />
            </View>
          ))}
        </View>
        <View style={styles.barLabels}>
          <AppText variant="caption">{data[0].value} {unit}</AppText>
          <AppText variant="label" color={aura}>{data[data.length - 1].value} {unit}</AppText>
        </View>
      </View>
    </Section>
  );
}

/** Exercise detail. Hero: your PR and its tier. */
export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile, user } = useAuth();
  const world = useWorld();
  const [exercise, setExercise] = useState<any>(null);
  const [pr, setPr] = useState<any>(null);
  const [recentSets, setRecentSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    Promise.all([
      supabase.from('exercises').select('*').eq('id', id).single(),
      // Scoped to this user — RLS also exposes friends'/public sets and PRs,
      // which leaked strangers' lifts into the PR card and e1RM chart (and
      // made .single() error when more than one PR row was visible).
      supabase.from('personal_records').select('*').eq('exercise_id', id).eq('user_id', user.id).maybeSingle(),
      supabase.from('workout_sets')
        .select('*, workouts!inner(started_at, name, user_id)')
        .eq('exercise_id', id)
        .eq('workouts.user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(30),
    ]).then(([{ data: ex }, { data: prData }, { data: sets }]) => {
      setExercise(ex);
      setPr(prData);
      setRecentSets(sets ?? []);
      setLoading(false);
    });
  }, [id, user?.id]);

  if (loading) {
    return <SafeAreaView style={styles.loading}><ActivityIndicator color={world.aura} /></SafeAreaView>;
  }

  if (!exercise) return null;

  const bw = profile?.bodyweight_lbs ?? 185;
  const unit = unitFromProfile(profile?.unit_pref);
  const prWeight = pr?.weight ?? 0;
  const currentTier = getTierForWeight(exercise.name, prWeight, bw, profile?.gender);
  const tierIdx = TIER_ORDER.indexOf(currentTier);
  // Strength standards exist only for the SBD lifts; thresholds are absolute lbs
  // scaled to the user's bodyweight via the competition-data lookup.
  const SBD_LIFT_MAP: Record<string, 'squat' | 'bench' | 'deadlift'> = {
    'barbell back squats': 'squat', 'barbell back squat': 'squat',
    'barbell bench press': 'bench',
    'deadlifts': 'deadlift', 'deadlift': 'deadlift',
  };
  const sbdLift = SBD_LIFT_MAP[exercise.name.toLowerCase()];
  const sbdGender: 'male' | 'female' = profile?.gender === 'female' ? 'female' : 'male';
  // 24-step threshold table → entry weight for each rank is index rank*4
  const rankThresholds = sbdLift ? getScaledThresholds(sbdLift, bw, sbdGender) : null;

  // Group recent sets by workout session
  const byWorkout = recentSets.reduce<Record<string, any[]>>((acc, s) => {
    const key = s.workouts?.name ?? s.workout_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  // Build chart data — top estimated 1RM (Epley) per session, chronological.
  // e1RM beats raw top-set weight as a trend signal: 225×5 improving to
  // 225×8 is real progress a weight-only chart would hide.
  const chartData = Object.entries(byWorkout)
    .map(([name, sets]) => ({
      name,
      date: sets[0]?.workouts?.started_at ?? '',
      topE1rm: Math.round(Math.max(
        ...(sets as any[]).map((s: any) => (s.weight ?? 0) * (1 + (s.reps ?? 0) / 30))
      )),
    }))
    .filter(d => d.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-10)
    .map(d => ({ value: Math.round(toDisplay(d.topE1rm, unit)) }));

  // Loading guide off the current PR's e1RM, in the user's unit, rounded to
  // real plate increments (5 lbs / 2.5 kg)
  const prE1rm = pr && pr.weight > 0 ? pr.weight * (1 + pr.reps / 30) : 0;
  const prE1rmDisplay = unit === 'kg' ? prE1rm / LBS_PER_KG : prE1rm;
  const increment = unit === 'kg' ? 2.5 : 5;
  const loadingGuide = prE1rm > 0 ? [
    { pct: 65, use: 'Warm-up · speed work' },
    { pct: 75, use: 'Volume · 8–10 reps' },
    { pct: 85, use: 'Strength · 4–6 reps' },
    { pct: 95, use: 'Peaking · 1–2 reps' },
  ].map(r => ({ ...r, weight: Math.round((prE1rmDisplay * r.pct) / 100 / increment) * increment })) : null;

  const tier = RANK_TIERS[Math.max(0, tierIdx)];
  const sessions = Object.entries(byWorkout).slice(0, 5);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityLabel="Back">
            <IconSymbol name="chevronBack" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.flex}>
            <AppText variant="title">{exercise.name}</AppText>
            <AppText variant="caption">{exercise.muscle_group}{exercise.secondary_muscle ? ` · ${exercise.secondary_muscle}` : ''}</AppText>
          </View>
        </View>

        {pr && (
          <MangaPanel motif="hero" color={sbdLift ? tier.color : undefined}>
            <AppText variant="label">Personal record</AppText>
            <View style={styles.prRow}>
              <AppText variant="power" style={styles.prValue}>{toDisplay(pr.weight, unit)}</AppText>
              <AppText variant="stat" color={Colors.textSecondary}>{unit} × {pr.reps}</AppText>
            </View>
            {sbdLift && <AppText variant="heading" color={tier.color} style={styles.tier}>{tier.label}</AppText>}
          </MangaPanel>
        )}

        {rankThresholds && (
          <Section title={`Rank entry at ${toDisplay(bw, unit)} ${unit}`}>
            <View style={styles.list}>
              {[...RANK_TIERS].reverse().map((t, i) => {
                const idx = RANK_TIERS.indexOf(t);
                const reached = idx <= tierIdx && prWeight > 0;
                return (
                  <View key={t.key} style={[styles.row, i > 0 && styles.divider, !reached && styles.dim]}>
                    <View style={[styles.mark, { backgroundColor: reached ? t.color : Colors.surface3 }]} />
                    <AppText variant="heading" color={t.color} style={styles.flex}>{titleCase(t.label)}</AppText>
                    <AppText variant="stat" style={styles.rowStat}>{toDisplay(rankThresholds[idx * 4], unit)} {unit}</AppText>
                  </View>
                );
              })}
            </View>
          </Section>
        )}

        {chartData.length >= 2 && <E1rmBars data={chartData} unit={unit} aura={world.aura} />}

        {loadingGuide && (
          <Section title="Loading guide">
            <AppText variant="caption">% of your estimated 1RM ({Math.round(prE1rmDisplay)} {unit}), rounded to {increment}.</AppText>
            <View style={styles.list}>
              {loadingGuide.map((r, i) => (
                <View key={r.pct} style={[styles.row, i > 0 && styles.divider]}>
                  <AppText variant="stat" color={world.aura} style={styles.pct}>{r.pct}%</AppText>
                  <AppText variant="stat" style={styles.guideWeight}>{r.weight} {unit}</AppText>
                  <AppText variant="caption" style={styles.flex}>{r.use}</AppText>
                </View>
              ))}
            </View>
          </Section>
        )}

        <Section title="Movement">
          <View style={[styles.card, styles.centerItems]}>
            <ExerciseAnimation exerciseName={exercise.name} muscleGroup={exercise.muscle_group} equipmentType={exercise.equipment_type} />
          </View>
        </Section>

        <Section title="Muscles worked">
          <View style={[styles.card, styles.centerItems]}>
            <MuscleMap primaryMuscle={exercise.muscle_group} secondaryMuscle={exercise.secondary_muscle} />
          </View>
        </Section>

        {exercise.form_cues && (
          <Section title="How to do it">
            <View style={styles.cues}>
              {exercise.form_cues.split('. ').filter((c: string) => c.trim()).map((cue: string, i: number) => (
                <View key={i} style={styles.cue}>
                  <AppText variant="stat" color={world.aura} style={styles.cueNo}>{i + 1}</AppText>
                  <AppText variant="body" style={styles.flex}>{cue.trim().replace(/\.$/, '')}</AppText>
                </View>
              ))}
            </View>
          </Section>
        )}

        {sessions.length > 0 && (
          <Section title="Recent sessions">
            <View style={styles.list}>
              {sessions.map(([name, sets], i) => (
                <View key={i} style={[styles.session, i > 0 && styles.divider]}>
                  <AppText variant="label" color={Colors.text}>{name}</AppText>
                  <AppText variant="label" mono>
                    {(sets as any[]).map((st: any) => `${st.weight === 0 ? 'BW' : toDisplay(st.weight, unit)}×${st.reps}${st.rpe ? ` @${st.rpe}` : ''}`).join('   ')}
                  </AppText>
                </View>
              ))}
            </View>
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  loading: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.screenH, paddingBottom: 60, gap: Spacing.group },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  back: { width: Hit.min, height: Hit.min, alignItems: 'center', justifyContent: 'center', marginLeft: -Spacing.md },
  flex: { flex: 1, gap: 2 },
  prRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  prValue: { fontSize: 52, lineHeight: 56 },
  tier: { fontFamily: Fonts.display, marginTop: Spacing.xs },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg },
  centerItems: { alignItems: 'center' },
  list: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 48, paddingHorizontal: Spacing.lg },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  dim: { opacity: 0.45 },
  mark: { width: 10, height: 10, transform: [{ rotate: '45deg' }] },
  rowStat: { fontSize: 16 },
  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  pct: { width: 52, fontSize: 16 },
  guideWeight: { width: 92, fontSize: 16 },
  cues: { gap: Spacing.md },
  cue: { flexDirection: 'row', gap: Spacing.md },
  cueNo: { width: 22, fontSize: 16 },
  session: { padding: Spacing.lg, gap: 4 },
});
