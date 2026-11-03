import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Dimensions, FlatList, ScrollView, StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { AppText, Button, IconSymbol, SheetModal } from '@/components/ui';
import { Colors, Fonts, Hit, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { CreateExerciseForm, MUSCLE_GROUPS } from './CreateExerciseForm';

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  secondary_muscle?: string;
  equipment_type?: string;
}

// DB rows use `null` for absent fields; normalize at the boundary.
const toExercise = (r: {
  id: string; name: string; muscle_group: string;
  secondary_muscle?: string | null; equipment_type?: string | null;
}): Exercise => ({
  id: r.id, name: r.name, muscle_group: r.muscle_group,
  secondary_muscle: r.secondary_muscle ?? undefined,
  equipment_type: r.equipment_type ?? undefined,
});

interface Props {
  visible: boolean;
  alreadyAdded: string[];
  onSelect: (exercise: Exercise & { equipment_type?: string }) => void;
  onClose: () => void;
}

// Most commonly used per group — shown first
const FEATURED: Record<string, string[]> = {
  'Chest':        ['Barbell Bench Press', 'Incline Barbell Bench Press', 'Dumbbell Bench Press', 'Dips', 'Pec Deck Cable Flys', 'Cable Crossover'],
  'Shoulders':    ['Overhead Press', 'Dumbbell Lateral Raise', 'Cable Lateral Raise', 'Arnold Press', 'Face Pulls', 'Rear Delt Fly'],
  'Triceps':      ['Close Grip Bench Press', 'Skull Crushers', 'Rope Pushdown', 'Overhand Pushdowns', 'Katana Extensions', 'JM Press'],
  'Biceps':       ['Bicep Curl', 'Hammer Curl', 'Preacher Curl', 'EZ Bar Curl', 'Cable Curl', 'Incline Curl'],
  'Mid-Upper Back':['Barbell Row', 'Pullups', 'Lat Pulldowns', 'Seated Cable Row', 'T-Bar Row', 'Face Pulls'],
  'Lats':         ['Lat Pulldowns', 'Pullups', 'Lat Pullover', 'Straight Arm Pulldown'],
  'Quads':        ['Barbell Back Squats', 'Hack Squats', 'Leg Press', 'Leg Extensions', 'Bulgarian Split Squat'],
  'Hamstrings':   ['Barbell RDLs', 'Leg Curl', 'Nordic Hamstring Curl', 'Good Mornings', 'Dumbbell RDLs'],
  'Glutes':       ['Hip Thrust', 'KAS Glute Bridge', 'Glute Focused Back Extension'],
  'Overall':      ['Deadlifts', 'Power Clean', 'Trap Bar Deadlift', 'Rack Pull'],
  'Core':         ['Ab Wheel Rollout', 'Hanging Leg Raise', 'Pallof Press', 'Cable Crunch', 'Dead Bug'],
  'Calves':       ['Standing Calf Raise', 'Seated Calf Raise', 'Leg Press Calf Raise'],
};

const SHEET_H = Math.round(Dimensions.get('window').height * 0.88);

export function ExercisePickerModal({ visible, alreadyAdded, onSelect, onClose }: Props) {
  const world = useWorld();
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('All');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!visible) return;
    supabase
      .from('exercises')
      .select('id, name, muscle_group, secondary_muscle, equipment_type')
      .order('muscle_group')
      .order('name')
      .then(({ data }) => { setExercises((data ?? []).map(toExercise)); setLoading(false); });
  }, [visible]);

  const featured = group !== 'All' ? (FEATURED[group] ?? []) : [];
  const filtered = useMemo(() => {
    let list = group !== 'All' ? exercises.filter(e => e.muscle_group === group) : exercises;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(e => e.name.toLowerCase().includes(q));
    const rank = (n: string) => featured.findIndex(f => f.toLowerCase() === n.toLowerCase());
    return [...list].sort((a, b) => {
      const ai = rank(a.name), bi = rank(b.name);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [exercises, search, group]);

  const close = () => { setSearch(''); setGroup('All'); setCreating(false); onClose(); };

  const renderItem = useCallback(({ item }: { item: Exercise }) => {
    const added = alreadyAdded.includes(item.id);
    const popular = !search.trim() && featured.some(f => f.toLowerCase() === item.name.toLowerCase());
    return (
      <TouchableOpacity
        onPress={() => { if (!added) { onSelect(item); close(); } }}
        activeOpacity={added ? 1 : 0.7}
        style={[styles.row, added && styles.added]}
        accessibilityLabel={`${item.name}${added ? ', already added' : ''}`}
      >
        <View style={styles.flex}>
          <View style={styles.nameRow}>
            <AppText variant="heading" numberOfLines={1} style={styles.shrink}>{item.name}</AppText>
            {popular && <AppText variant="caption" color={world.aura}>Popular</AppText>}
          </View>
          <AppText variant="caption" numberOfLines={1}>
            {[item.muscle_group, item.secondary_muscle, item.equipment_type].filter(Boolean).join(' · ')}
          </AppText>
        </View>
        {added
          ? <AppText variant="caption">Added</AppText>
          : <IconSymbol name="add" size={22} color={world.aura} />}
      </TouchableOpacity>
    );
  }, [alreadyAdded, group, search, world.aura]);

  return (
    <SheetModal visible={visible} onClose={close} snapHeight={SHEET_H}>
      {creating && user ? (
        <CreateExerciseForm
          userId={user.id}
          initialName={search}
          onBack={() => setCreating(false)}
          onCreated={row => {
            const ex = toExercise(row);
            setExercises(prev => [...prev, ex]);
            onSelect(ex);
            close();
          }}
        />
      ) : (
        <View style={styles.flex}>
          <View style={styles.head}>
            <AppText variant="title" style={styles.flex}>Add exercise</AppText>
            <Button label="New" icon="add" variant="tinted" size="sm" onPress={() => setCreating(true)} />
          </View>
          <View style={styles.search}>
            <IconSymbol name="search" size={16} color={Colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search exercises"
              placeholderTextColor={Colors.textMuted}
              autoCorrect={false}
              style={styles.searchInput}
            />
          </View>
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groups}>
              {MUSCLE_GROUPS.map(g => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setGroup(g)}
                  style={[styles.group, group === g && { backgroundColor: world.aura + '1F', borderColor: world.aura }]}
                >
                  <AppText variant="label" color={group === g ? world.aura : Colors.textSecondary}>{g}</AppText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={world.aura} /></View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.empty}>
                  <AppText variant="body">No exercises found</AppText>
                  {!!search.trim() && <Button label={`Create "${search.trim()}"`} variant="tinted" onPress={() => setCreating(true)} />}
                </View>
              }
            />
          )}
        </View>
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.md },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, minHeight: 48,
    backgroundColor: Colors.surface2, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.borderLight,
  },
  searchInput: { flex: 1, color: Colors.text, fontFamily: Fonts.body, fontSize: 16, minHeight: 48 },
  groups: { gap: Spacing.sm, paddingVertical: Spacing.md },
  group: {
    minHeight: 36, paddingHorizontal: Spacing.md, justifyContent: 'center',
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface2,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 60, paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  added: { opacity: 0.4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
});
