import { StyleSheet, View } from 'react-native';
import { AppText, PressableScale, Section } from '@/components/ui';
import { Colors, Hit, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { supabase } from '@/lib/supabase';

// Moved here from onboarding. Stored in the same columns the coach reads.
const GOALS = [
  { key: 'strength', label: 'Get stronger' },
  { key: 'muscle', label: 'Build muscle' },
  { key: 'fat_loss', label: 'Lose fat' },
  { key: 'compete', label: 'Compete' },
  { key: 'athletic', label: 'Stay athletic' },
];
const STYLES = [
  { key: 'powerlifting', label: 'Powerlifting' },
  { key: 'bodybuilding', label: 'Bodybuilding' },
  { key: 'hybrid', label: 'Hybrid' },
  { key: 'calisthenics', label: 'Calisthenics' },
  { key: 'athletic', label: 'Athletic' },
];

interface Props {
  userId: string;
  goal: string | null | undefined;
  style: string | null | undefined;
  /** Training DNA (free text) — opens the existing editor */
  dna: string | null | undefined;
  onEditDna: () => void;
  /** e.g. "Push / Pull / Legs" — null when unset */
  splitLabel: string | null;
  onEditSplit: () => void;
  onSaved: () => void;
}

/** Goal, style, and training DNA — optional context for the coach. */
export function TrainingProfile({ userId, goal, style, dna, onEditDna, splitLabel, onEditSplit, onSaved }: Props) {
  const world = useWorld();
  const setField = async (field: 'primary_goal' | 'training_style', value: string | null) => {
    await supabase.from('users').update({ [field]: value } as any).eq('id', userId);
    onSaved();
  };

  const chips = (opts: typeof GOALS, current: string | null | undefined, field: 'primary_goal' | 'training_style') => (
    <View style={styles.chips}>
      {opts.map(o => {
        const on = current === o.key;
        return (
          <PressableScale
            key={o.key}
            onPress={() => setField(field, on ? null : o.key)}
            accessibilityState={{ selected: on }}
            style={[styles.chip, on && { borderColor: world.aura, backgroundColor: world.aura + '1F' }]}
          >
            <AppText variant="label" color={on ? world.aura : Colors.textSecondary}>{o.label}</AppText>
          </PressableScale>
        );
      })}
    </View>
  );

  return (
    <Section title="Training profile">
      <AppText variant="caption">Optional. Your coach uses this for context.</AppText>
      <View style={styles.group}>
        <AppText variant="label">Goal</AppText>
        {chips(GOALS, goal, 'primary_goal')}
      </View>
      <View style={styles.group}>
        <AppText variant="label">Style</AppText>
        {chips(STYLES, style, 'training_style')}
      </View>
      <PressableScale onPress={onEditSplit} style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="heading">My split</AppText>
          <AppText variant="caption">{splitLabel ?? 'Set a session per day — Home and your coach use it'}</AppText>
        </View>
        <AppText variant="label" color={world.aura}>{splitLabel ? 'Edit' : 'Set up'}</AppText>
      </PressableScale>
      <PressableScale onPress={onEditDna} style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="heading">Training DNA</AppText>
          <AppText variant="caption" numberOfLines={2}>{dna?.trim() || 'Injuries, gym setup, what you love and hate'}</AppText>
        </View>
        <AppText variant="label" color={world.aura}>Edit</AppText>
      </PressableScale>
    </Section>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    minHeight: Hit.min - 8, paddingHorizontal: Spacing.md, justifyContent: 'center',
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 60, paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
  },
  flex: { flex: 1, gap: 2, paddingVertical: Spacing.sm },
});
