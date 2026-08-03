import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppText, Button, Card, IconSymbol, SkeletonBlock } from '@/components/ui';
import { STARTER_PROGRAMS, StarterProgramDay } from '@/constants/starterPrograms';
import { DaySuggestion, RecentTemplate } from '@/hooks/useWorkoutTemplates';

const MUSCLE_COLORS: Record<string, string> = {
  'Chest': '#C2566B', 'Shoulders': '#9B59B6', 'Triceps': '#8E44AD',
  'Biceps': '#3498DB', 'Mid-Upper Back': '#1ABC9C', 'Lats': '#16A085',
  'Quads': '#E67E22', 'Hamstrings': '#D35400', 'Glutes': '#E74C3C',
  'Core': '#F39C12', 'Overall': Colors.textSecondary,
};

interface WorkoutIdleScreenProps {
  isNewLifter: boolean;
  daySuggestion: DaySuggestion | null;
  templates: RecentTemplate[];
  savedTemplates: any[];
  loadingTemplates: boolean;
  onStartBlank: () => void;
  onStartFromTemplate: (name: string, exercises: DaySuggestion['exercises']) => void;
  onStartFromSavedTemplate: (tmpl: any) => void;
  onStartStarterDay: (day: StarterProgramDay) => void;
  onDeleteTemplate: (id: string) => void;
  onPinSuggestion: () => void;
  onUnpinSuggestion: () => void;
  onCreateTemplate: () => void;
}

export function WorkoutIdleScreen({
  isNewLifter, daySuggestion, templates, savedTemplates, loadingTemplates,
  onStartBlank, onStartFromTemplate, onStartFromSavedTemplate, onStartStarterDay,
  onDeleteTemplate, onPinSuggestion, onUnpinSuggestion, onCreateTemplate,
}: WorkoutIdleScreenProps) {
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  // One Quick Start list: saved templates first, then recent sessions that
  // aren't already saved under the same name (capped so the screen stays calm)
  const savedNames = new Set(savedTemplates.map((t: any) => String(t.name).toLowerCase()));
  const quickStartRecents = templates.filter(t => !savedNames.has(t.name.toLowerCase())).slice(0, 3);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <AppText variant="overline">{todayName}</AppText>
          <AppText variant="display" style={styles.headline}>Your arc continues.</AppText>
        </View>

        {/* Day suggestion */}
        {daySuggestion && (
          <View style={styles.section}>
            <View style={styles.suggestionHeader}>
              <AppText variant="overline" style={styles.kicker}>
                {daySuggestion.isPinned ? daySuggestion.dayLabel : `${daySuggestion.dayLabel} you trained`}
              </AppText>
              {!daySuggestion.isPinned ? (
                <TouchableOpacity onPress={onPinSuggestion} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <View style={styles.pinRow}>
                    <IconSymbol name="pin" size={12} color={Colors.accent} />
                    <AppText variant="micro" color={Colors.accent} style={styles.pinText}>Pin for today</AppText>
                  </View>
                </TouchableOpacity>
              ) : daySuggestion.pinnedTemplateId ? (
                <TouchableOpacity onPress={onUnpinSuggestion} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <AppText variant="micro">Unpin</AppText>
                </TouchableOpacity>
              ) : null}
            </View>
            <Card padding="lg" style={{ borderColor: Colors.accent + (daySuggestion.isPinned ? '70' : '50'), borderWidth: 1.5 }}>
              <AppText variant="heading" style={styles.suggestionName}>{daySuggestion.name}</AppText>
              <AppText variant="caption" color={Colors.textMuted} style={styles.suggestionExs}>
                {daySuggestion.exercises.slice(0, 4).map(e => e.name).join(' · ')}
                {daySuggestion.exercises.length > 4 ? ` +${daySuggestion.exercises.length - 4} more` : ''}
              </AppText>
              <Button
                label={daySuggestion.isPinned ? 'Start my plan →' : 'Repeat this session →'}
                onPress={() => onStartFromTemplate(daySuggestion.name, daySuggestion.exercises)}
                fullWidth
                haptic="medium"
              />
            </Card>
          </View>
        )}

        {/* Start blank — hero when there's no suggestion, quiet otherwise */}
        <View style={styles.section}>
          <Button
            label={daySuggestion ? '+ Start blank workout' : 'Start Workout'}
            onPress={onStartBlank}
            variant={daySuggestion ? 'secondary' : 'primary'}
            size={daySuggestion ? 'md' : 'lg'}
            fullWidth
            haptic="medium"
          />
        </View>

        {/* Starter programs — "just tell me what to do" for new lifters */}
        {isNewLifter && (
          <View style={styles.section}>
            <AppText variant="overline" style={styles.kicker}>Starter Programs</AppText>
            <AppText variant="caption" color={Colors.textSecondary} style={styles.sectionSub}>
              No guesswork — pick a day, the exercises are loaded, just show up.
            </AppText>
            <View style={styles.cardsCol}>
              {STARTER_PROGRAMS.map(program => (
                <Card key={program.key} padding="lg">
                  <AppText variant="heading">{program.title}</AppText>
                  <AppText variant="micro" style={styles.programSchedule}>{program.schedule}</AppText>
                  <AppText variant="caption" color={Colors.textSecondary} style={styles.programTagline}>
                    {program.tagline}
                  </AppText>
                  <View style={styles.daysCol}>
                    {program.days.map(day => (
                      <TouchableOpacity
                        key={day.key}
                        onPress={() => onStartStarterDay(day)}
                        activeOpacity={0.8}
                        style={styles.dayRow}
                      >
                        <View style={styles.dayText}>
                          <AppText variant="caption" color={Colors.text} style={styles.dayName}>{day.name}</AppText>
                          <AppText variant="micro">{day.focus} · {day.guidance}</AppText>
                        </View>
                        <AppText variant="micro" color={Colors.accent} style={styles.startChip}>Start →</AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Card>
              ))}
            </View>
          </View>
        )}

        {/* Quick Start — saved templates + recent sessions, one calm list */}
        {(savedTemplates.length > 0 || quickStartRecents.length > 0) && (
          <View style={styles.section}>
            <AppText variant="overline" style={styles.kicker}>Quick Start</AppText>
            <View style={styles.cardsCol}>
              {savedTemplates.map((tmpl: any) => (
                <Card
                  key={tmpl.id}
                  padding="lg"
                  style={{ borderColor: Colors.accent + '30' }}
                  onPress={() => onStartFromSavedTemplate(tmpl)}
                >
                  <View style={styles.tmplHeader}>
                    <AppText variant="heading" numberOfLines={1} style={styles.tmplName}>{tmpl.name}</AppText>
                    <View style={styles.tmplStartChip}>
                      <AppText variant="micro" color={Colors.accent} style={styles.startChip}>Start →</AppText>
                    </View>
                  </View>
                  <View style={styles.chips}>
                    {(tmpl.exercises as any[]).map((ex: any, i: number) => (
                      <View key={i} style={styles.chip}>
                        <AppText variant="micro" color={Colors.textSecondary}>{ex.name}</AppText>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    onPress={() => Alert.alert(tmpl.name, 'Delete this template?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => onDeleteTemplate(tmpl.id) },
                    ])}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={styles.tmplFooter}
                  >
                    <AppText variant="micro">
                      {(tmpl.exercises as any[]).length} exercises · tap to delete
                    </AppText>
                  </TouchableOpacity>
                </Card>
              ))}

              {quickStartRecents.map(tmpl => {
                const daysAgo = Math.floor((Date.now() - new Date(tmpl.lastUsed).getTime()) / 86400000);
                const ageLabel = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`;
                return (
                  <Card key={tmpl.id} padding="lg" onPress={() => onStartFromTemplate(tmpl.name, tmpl.exercises)}>
                    <View style={styles.tmplHeader}>
                      <View style={styles.tmplName}>
                        <AppText variant="heading" numberOfLines={1}>{tmpl.name}</AppText>
                        <AppText variant="micro" style={styles.recentAge}>Recent session · last done {ageLabel}</AppText>
                      </View>
                      <View style={styles.repeatChip}>
                        <AppText variant="micro" color={Colors.textSecondary} style={styles.startChip}>Repeat →</AppText>
                      </View>
                    </View>
                    <View style={styles.chips}>
                      {tmpl.exercises.map((ex, i) => (
                        <View key={i} style={[styles.chip, styles.chipWithDot]}>
                          <View style={[styles.dot, { backgroundColor: MUSCLE_COLORS[ex.muscle_group] ?? Colors.textMuted }]} />
                          <AppText variant="micro" color={Colors.textSecondary}>{ex.name}</AppText>
                        </View>
                      ))}
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>
        )}

        {/* Create template from scratch */}
        <Card padding="lg" onPress={onCreateTemplate}>
          <View style={styles.createRow}>
            <View style={styles.createBadge}>
              <IconSymbol name="add" size={20} color={Colors.textMuted} />
            </View>
            <View style={styles.dayText}>
              <AppText variant="caption" color={Colors.text} style={styles.dayName}>Create Template</AppText>
              <AppText variant="micro">Build a reusable workout from scratch</AppText>
            </View>
          </View>
        </Card>

        {loadingTemplates && (
          <View style={styles.skeletons}>
            <SkeletonBlock height={96} radius={Radius.lg} />
            <SkeletonBlock height={96} radius={Radius.lg} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.screenH, paddingBottom: 48 },
  header: { marginBottom: Spacing.xl, gap: 2 },
  headline: { fontSize: 26, letterSpacing: -1 },
  section: { marginBottom: Spacing.xl },
  suggestionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  kicker: { fontSize: 10, letterSpacing: 2 },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pinText: { fontWeight: '700' },
  suggestionName: { marginBottom: 4 },
  suggestionExs: { marginBottom: Spacing.md + 2 },
  sectionSub: { marginTop: 4, marginBottom: Spacing.md },
  cardsCol: { gap: Spacing.md },
  programSchedule: { marginTop: 2 },
  programTagline: { marginTop: 4, marginBottom: Spacing.md, lineHeight: 17 },
  daysCol: { gap: Spacing.sm },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface2, borderRadius: Radius.md + 2,
    paddingVertical: 11, paddingHorizontal: Spacing.md + 2,
  },
  dayText: { flex: 1, gap: 1 },
  dayName: { fontWeight: '700' },
  startChip: { fontWeight: '800', fontSize: 12 },
  tmplHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 },
  tmplName: { flex: 1 },
  tmplStartChip: {
    backgroundColor: Colors.accentDim, borderRadius: Radius.sm + 2,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.accent + '40',
  },
  repeatChip: { backgroundColor: Colors.surface2, borderRadius: Radius.sm + 2, paddingHorizontal: 10, paddingVertical: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: Colors.surface2, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  chipWithDot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  recentAge: { marginTop: 2 },
  tmplFooter: { marginTop: 8 },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  createBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface2,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  skeletons: { gap: Spacing.md, marginTop: Spacing.lg },
});
