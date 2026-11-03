import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppText, Button, IconSymbol, Section, SkeletonBlock } from '@/components/ui';
import { MangaPanel } from '@/components/anime';
import { useWorld } from '@/theme';
import { STARTER_PROGRAMS, StarterProgramDay } from '@/constants/starterPrograms';
import { DaySuggestion, RecentTemplate } from '@/hooks/useWorkoutTemplates';

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

const exerciseLine = (names: string[]) =>
  names.slice(0, 4).join(' · ') + (names.length > 4 ? ` +${names.length - 4}` : '');

function ListRow({ title, sub, onPress, onLongPress, action }: {
  title: string; sub?: string; onPress: () => void; onLongPress?: () => void; action?: string;
}) {
  const world = useWorld();
  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} style={styles.row} accessibilityRole="button">
      <View style={styles.flex}>
        <AppText variant="heading" numberOfLines={1}>{title}</AppText>
        {sub ? <AppText variant="caption" numberOfLines={1}>{sub}</AppText> : null}
      </View>
      {action ? <AppText variant="label" color={world.aura}>{action}</AppText> : <IconSymbol name="chevronRight" size={16} color={Colors.textMuted} />}
    </TouchableOpacity>
  );
}

/**
 * Idle: today's planned session (if any) on top, "Start empty workout" as the
 * primary, then templates as one simple list.
 */
export function WorkoutIdleScreen({
  isNewLifter, daySuggestion, templates, savedTemplates, loadingTemplates,
  onStartBlank, onStartFromTemplate, onStartFromSavedTemplate, onStartStarterDay,
  onDeleteTemplate, onPinSuggestion, onUnpinSuggestion, onCreateTemplate,
}: WorkoutIdleScreenProps) {
  const savedNames = new Set(savedTemplates.map((t: any) => String(t.name).toLowerCase()));
  const recents = templates.filter(t => !savedNames.has(t.name.toLowerCase())).slice(0, 3);

  const confirmDelete = (tmpl: any) => Alert.alert(tmpl.name, 'Delete this template?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => onDeleteTemplate(tmpl.id) },
  ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppText variant="display">Train</AppText>

        {daySuggestion && (
          <MangaPanel motif="header">
            <View style={styles.today}>
              <View style={styles.todayHead}>
                <AppText variant="label" style={styles.flex}>
                  {daySuggestion.isPinned ? daySuggestion.dayLabel : `${daySuggestion.dayLabel} you trained`}
                </AppText>
                {!daySuggestion.isPinned ? (
                  <TouchableOpacity onPress={onPinSuggestion} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <AppText variant="label" color={Colors.textSecondary}>Pin for today</AppText>
                  </TouchableOpacity>
                ) : daySuggestion.pinnedTemplateId ? (
                  <TouchableOpacity onPress={onUnpinSuggestion} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <AppText variant="label" color={Colors.textSecondary}>Unpin</AppText>
                  </TouchableOpacity>
                ) : null}
              </View>
              <AppText variant="title">{daySuggestion.name}</AppText>
              <AppText variant="caption">{exerciseLine(daySuggestion.exercises.map(e => e.name))}</AppText>
              <Button
                label={daySuggestion.isPinned ? "Start today's plan" : 'Repeat this session'}
                onPress={() => onStartFromTemplate(daySuggestion.name, daySuggestion.exercises)}
                fullWidth
                size="lg"
                haptic="medium"
              />
            </View>
          </MangaPanel>
        )}

        <Button
          label="Start empty workout"
          onPress={onStartBlank}
          variant={daySuggestion ? 'secondary' : 'primary'}
          size="lg"
          fullWidth
          haptic="medium"
        />

        {(savedTemplates.length > 0 || recents.length > 0) && (
          <Section title="Templates" action={{ label: 'New template', onPress: onCreateTemplate }}>
            <View style={styles.list}>
              {savedTemplates.map((tmpl: any) => (
                <ListRow
                  key={tmpl.id}
                  title={tmpl.name}
                  sub={exerciseLine((tmpl.exercises as any[]).map(e => e.name))}
                  onPress={() => onStartFromSavedTemplate(tmpl)}
                  onLongPress={() => confirmDelete(tmpl)}
                  action="Start"
                />
              ))}
              {recents.map(tmpl => {
                const days = Math.floor((Date.now() - new Date(tmpl.lastUsed).getTime()) / 86400000);
                const age = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`;
                return (
                  <ListRow
                    key={tmpl.id}
                    title={tmpl.name}
                    sub={`Recent · ${age} · ${exerciseLine(tmpl.exercises.map(e => e.name))}`}
                    onPress={() => onStartFromTemplate(tmpl.name, tmpl.exercises)}
                    action="Repeat"
                  />
                );
              })}
            </View>
            {savedTemplates.length > 0 && <AppText variant="caption">Long-press a saved template to delete it.</AppText>}
          </Section>
        )}

        {savedTemplates.length === 0 && recents.length === 0 && !loadingTemplates && (
          <Button label="Create a template" variant="ghost" onPress={onCreateTemplate} fullWidth />
        )}

        {isNewLifter && (
          <Section title="Starter programs">
            <AppText variant="caption">Pick a day — the exercises load, you just show up.</AppText>
            {STARTER_PROGRAMS.map(program => (
              <View key={program.key} style={styles.group}>
                <AppText variant="label" color={Colors.text}>{program.title} · {program.schedule}</AppText>
                <View style={styles.list}>
                  {program.days.map(day => (
                    <ListRow key={day.key} title={day.name} sub={`${day.focus} · ${day.guidance}`} onPress={() => onStartStarterDay(day)} action="Start" />
                  ))}
                </View>
              </View>
            ))}
          </Section>
        )}

        {loadingTemplates && (
          <View style={styles.group}>
            <SkeletonBlock height={60} radius={Radius.lg} />
            <SkeletonBlock height={60} radius={Radius.lg} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.screenH, paddingBottom: 48, gap: Spacing.group },
  today: { gap: Spacing.sm },
  todayHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1, gap: 2 },
  list: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 60, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  group: { gap: Spacing.sm },
});
