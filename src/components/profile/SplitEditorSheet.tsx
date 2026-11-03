import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { AppText, Button, IconSymbol, SheetModal } from '@/components/ui';
import { Colors, Fonts, Hit, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { supabase } from '@/lib/supabase';
import { SESSION_TYPES } from '@/lib/sessionType';

type Ex = { id: string; name: string; muscle_group: string };
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const SHEET_H = Math.round(Dimensions.get('window').height * 0.88);

export function splitLabelFromSchedule(schedule: Record<number, string>): string {
  const types = [...new Set(Object.values(schedule))];
  if (types.includes('Push') && types.includes('Pull') && types.includes('Legs')) return 'Push / Pull / Legs';
  if ((types.includes('Upper') || (types.includes('Push') && types.includes('Pull'))) && types.includes('Legs')) return 'Upper / Lower';
  if (types.includes('Upper') && types.includes('Legs')) return 'Upper / Lower';
  if (types.length > 0 && types.every(t => t === 'Full Body')) return 'Full Body';
  if (types.length === 1 && types[0]) return types[0];
  return 'Custom';
}

function search(all: Ex[], exclude: Ex[], q: string): Ex[] {
  const query = q.toLowerCase().trim();
  const words = query.split(' ').filter(w => w.length > 1);
  return all
    .filter(e => !exclude.some(x => x.id === e.id))
    .map(e => {
      const n = e.name.toLowerCase();
      const m = (e.muscle_group ?? '').toLowerCase();
      let score = 0;
      if (n === query) score = 100;
      else if (n.startsWith(query)) score = 90;
      else if (n.includes(query)) score = 80;
      else {
        const nm = words.filter(w => n.includes(w)).length;
        if (nm > 0) score = 40 + nm * 10 + words.filter(w => m.includes(w)).length * 5;
      }
      return { e, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(x => x.e);
}

interface Props {
  visible: boolean;
  userId: string;
  schedule: Record<string, string> | null | undefined;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

/** Weekly split: a session type per day, plus exercises pinned as that day's template. */
export function SplitEditorSheet({ visible, userId, schedule, onClose, onSaved }: Props) {
  const world = useWorld();
  const [days, setDays] = useState<Record<number, string>>({});
  const [dayEx, setDayEx] = useState<Record<number, Ex[]>>({});
  const [all, setAll] = useState<Ex[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const conv: Record<number, string> = {};
    Object.entries(schedule ?? {}).forEach(([k, v]) => { conv[Number(k)] = v; });
    setDays(conv);
    setActive(null);
    setQuery('');
    Promise.all([
      supabase.from('workout_templates').select('*').eq('user_id', userId).order('last_used_at', { ascending: false, nullsFirst: false }),
      supabase.from('exercises').select('id, name, muscle_group').order('name'),
    ]).then(([{ data: t }, { data: ex }]) => {
      setTemplates(t ?? []);
      setAll((ex ?? []) as Ex[]);
      const init: Record<number, Ex[]> = {};
      (t ?? []).filter((x: any) => x.day_of_week != null).forEach((x: any) => { init[x.day_of_week] = x.exercises ?? []; });
      setDayEx(init);
    });
  }, [visible]);

  const pickSession = (day: number) => {
    const current = days[day];
    Alert.alert(DAY_FULL[day], 'What do you train?', [
      ...SESSION_TYPES.map(type => ({
        text: type === current ? `${type} (current)` : type,
        onPress: () => {
          setDays(prev => ({ ...prev, [day]: type }));
          if (templates.length === 0) return;
          // Offer to pin a saved template for this day
          setTimeout(() => Alert.alert(`Pin a template for ${DAY_FULL[day]}?`, 'It will pre-load every time you train this day.', [
            ...templates.slice(0, 4).map((tmpl: any) => ({
              text: tmpl.name,
              onPress: async () => {
                await supabase.from('workout_templates').update({ day_of_week: null }).eq('user_id', userId).eq('day_of_week', day);
                await supabase.from('workout_templates').update({ day_of_week: day }).eq('id', tmpl.id);
                Alert.alert('Pinned', `${tmpl.name} will pre-load every ${DAY_FULL[day]}.`);
              },
            })),
            { text: 'Skip for now', style: 'cancel' as const },
          ]), 400);
        },
      })),
      { text: 'Rest (clear)', style: 'destructive' as const, onPress: () => setDays(prev => { const n = { ...prev }; delete n[day]; return n; }) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('users').update({
      split_type: splitLabelFromSchedule(days),
      split_schedule: Object.keys(days).length > 0 ? days : null,
    }).eq('id', userId);
    if (error) { Alert.alert('Error', error.message); setSaving(false); return; }
    // Exercises per day become that day's pinned template (delete + insert, no unique constraint needed)
    for (const [d, exs] of Object.entries(dayEx)) {
      const day = Number(d);
      const type = days[day];
      if (!type) continue;
      await supabase.from('workout_templates').update({ day_of_week: null }).eq('user_id', userId).eq('day_of_week', day);
      if (exs.length === 0) continue;
      await supabase.from('workout_templates').insert({
        user_id: userId, name: `${type} Day`, day_of_week: day,
        exercises: exs.map(e => ({ id: e.id, name: e.name, muscle_group: e.muscle_group })),
      });
    }
    await onSaved();
    setSaving(false);
    onClose();
  };

  return (
    <SheetModal visible={visible} onClose={onClose} snapHeight={SHEET_H}>
      <View style={styles.head}>
        <AppText variant="title" style={styles.flex}>My split</AppText>
        {saving ? <ActivityIndicator color={world.aura} /> : <Button label="Save" size="sm" onPress={save} />}
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="always">
        <AppText variant="body">
          {Object.keys(days).length > 0
            ? `${splitLabelFromSchedule(days)} · ${Object.keys(days).length}× a week`
            : 'Tap a day to set its session. Your coach reads this.'}
        </AppText>
        {WEEK.map(day => {
          const type = days[day];
          const exs = dayEx[day] ?? [];
          return (
            <View key={day} style={[styles.day, type && { borderLeftColor: world.aura }]}>
              <TouchableOpacity onPress={() => pickSession(day)} style={styles.dayHead}>
                <View style={styles.flex}>
                  <AppText variant="heading">{DAY_FULL[day]}</AppText>
                  <AppText variant="caption" color={type ? world.aura : undefined}>{type ?? 'Rest · tap to set'}</AppText>
                </View>
                <IconSymbol name="chevronRight" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {type && (
                <View style={styles.exBlock}>
                  {exs.length > 0 && (
                    <View style={styles.chips}>
                      {exs.map((ex, i) => (
                        <TouchableOpacity
                          key={ex.id}
                          onPress={() => setDayEx(prev => ({ ...prev, [day]: (prev[day] ?? []).filter((_, j) => j !== i) }))}
                          style={styles.chip}
                          accessibilityLabel={`Remove ${ex.name}`}
                        >
                          <AppText variant="label" color={Colors.text}>{ex.name}</AppText>
                          <IconSymbol name="close" size={12} color={Colors.textMuted} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <TextInput
                    value={active === day ? query : ''}
                    onFocus={() => { setActive(day); setQuery(''); }}
                    onChangeText={setQuery}
                    placeholder={exs.length > 0 ? 'Add more exercises' : 'Add exercises for this day'}
                    placeholderTextColor={Colors.textMuted}
                    style={styles.search}
                  />
                  {active === day && query.length > 0 && (
                    <View style={styles.results}>
                      {search(all, exs, query).map(ex => (
                        <TouchableOpacity
                          key={ex.id}
                          onPress={() => setDayEx(prev => ({ ...prev, [day]: [...(prev[day] ?? []), ex] }))}
                          style={styles.result}
                        >
                          <AppText variant="body" color={Colors.text} style={styles.flex}>{ex.name}</AppText>
                          <AppText variant="caption">{ex.muscle_group}</AppText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.md },
  flex: { flex: 1, gap: 2 },
  body: { gap: Spacing.sm, paddingBottom: Spacing.xxl },
  day: { backgroundColor: Colors.surface2, borderLeftWidth: 3, borderLeftColor: Colors.border, borderRadius: Radius.sm },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 56, paddingHorizontal: Spacing.md },
  exBlock: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.sm, minHeight: 32, borderRadius: Radius.sm, backgroundColor: Colors.surface3 },
  search: {
    minHeight: Hit.min, borderRadius: Radius.md, paddingHorizontal: Spacing.md, backgroundColor: Colors.bg,
    color: Colors.text, fontFamily: Fonts.body, fontSize: 15,
  },
  results: { borderRadius: Radius.md, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 44, paddingHorizontal: Spacing.md, backgroundColor: Colors.surface },
});
