import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { AppText, Button, IconSymbol, Section, SheetModal } from '@/components/ui';
import { Colors, Fonts, Hit, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { useImport } from './useImport';

const PLACEHOLDER = '4/2/24\nBench Press: 225x5, 235x4, 235x4\nSquats: 315x5x3 @8\n\n4/4/24\nOHP: 155x5x3';

/** Paste a log from Notes, Docs, Hevy or Strong; review matches; save. */
export function ImportSection({ userId }: { userId: string | undefined }) {
  const world = useWorld();
  const imp = useImport(userId);
  const [open, setOpen] = useState<number | null>(null);
  const [picking, setPicking] = useState<{ wi: number; ei: number } | null>(null);
  const [search, setSearch] = useState('');

  const parsed = imp.parsed;
  const unmatched = parsed?.reduce((n, w) => n + w.exercises.filter(e => !e.matchedId).length, 0) ?? 0;
  const hasDupes = parsed?.some(w => {
    const ids = w.exercises.filter(e => e.matchedId).map(e => e.matchedId);
    return ids.length !== new Set(ids).size;
  });

  return (
    <Section title="Import history">
      {!parsed ? (
        <>
          <AppText variant="body">Paste a log from Notes, Docs, or a Hevy / Strong CSV. Sets like 225x5 or 315x5x3 @8.</AppText>
          <TextInput
            value={imp.text}
            onChangeText={imp.setText}
            placeholder={PLACEHOLDER}
            placeholderTextColor={Colors.textMuted}
            multiline
            style={styles.paste}
          />
          <Button label="Read my log" onPress={imp.parse} loading={imp.parsing} disabled={!imp.text.trim()} fullWidth />
        </>
      ) : (
        <>
          <View style={styles.head}>
            <AppText variant="heading" style={styles.flex}>{parsed.length} workout{parsed.length !== 1 ? 's' : ''} found</AppText>
            <Button label="Edit text" variant="ghost" size="sm" onPress={() => imp.setParsed(null)} />
          </View>
          {unmatched > 0 && <AppText variant="label" color={world.auraAlt}>{unmatched} exercise{unmatched !== 1 ? 's' : ''} need matching — tap to fix</AppText>}
          {hasDupes && <Button label="Merge duplicate exercises" variant="tinted" size="sm" onPress={imp.mergeAll} />}
          <View style={styles.list}>
            {parsed.map((w, wi) => {
              const missing = w.exercises.filter(e => !e.matchedId).length;
              return (
                <View key={wi} style={wi > 0 && styles.divider}>
                  <TouchableOpacity onPress={() => setOpen(open === wi ? null : wi)} style={styles.row}>
                    <View style={styles.flex}>
                      <AppText variant="heading" numberOfLines={1}>{w.name}</AppText>
                      <AppText variant="caption">
                        {w.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {w.exercises.length} exercises{missing ? ` · ${missing} unmatched` : ''}
                      </AppText>
                    </View>
                    <IconSymbol name={open === wi ? 'chevronUp' : 'chevronDown'} size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                  {open === wi && w.exercises.map((ex, ei) => (
                    <TouchableOpacity
                      key={ei}
                      onPress={() => {
                        setPicking({ wi, ei });
                        setSearch(ex.matchedId ? '' : ex.rawName.replace(/^[∙•\s\t]+/, '').split('—')[0].trim());
                      }}
                      style={styles.exRow}
                    >
                      <IconSymbol name={ex.matchedId ? 'checkCircle' : 'info'} size={16} color={ex.matchedId ? Colors.success : world.auraAlt} />
                      <View style={styles.flex}>
                        <AppText variant="body" color={ex.matchedId ? Colors.text : world.auraAlt}>{ex.matchedName}</AppText>
                        {!ex.matchedId && <AppText variant="caption" numberOfLines={1}>"{ex.rawName.slice(0, 50)}"</AppText>}
                      </View>
                      <AppText variant="caption">{ex.sets.length} sets</AppText>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
          </View>
          <Button label={`Save ${parsed.length} workout${parsed.length !== 1 ? 's' : ''}`} onPress={imp.save} loading={imp.saving} fullWidth size="lg" />
        </>
      )}

      <SheetModal visible={!!picking} onClose={() => setPicking(null)} title="Match exercise" snapHeight={520}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises"
          placeholderTextColor={Colors.textMuted}
          autoFocus
          style={styles.search}
        />
        <ScrollView keyboardShouldPersistTaps="handled">
          {imp.allExercises
            .filter(e => !search.trim() || e.name.toLowerCase().includes(search.toLowerCase()))
            .slice(0, 60)
            .map(ex => (
              <TouchableOpacity
                key={ex.id}
                onPress={() => { if (picking) imp.match(picking.wi, picking.ei, ex); setPicking(null); }}
                style={styles.pickRow}
              >
                <AppText variant="heading">{ex.name}</AppText>
                <AppText variant="caption">{ex.muscle_group}</AppText>
              </TouchableOpacity>
            ))}
        </ScrollView>
      </SheetModal>
    </Section>
  );
}

const styles = StyleSheet.create({
  paste: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg,
    minHeight: 180, textAlignVertical: 'top', color: Colors.text, fontFamily: Fonts.body, fontSize: 14, lineHeight: 22,
  },
  head: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, gap: 2 },
  list: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 56, paddingHorizontal: Spacing.lg },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: Hit.min, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.surface2 },
  search: {
    backgroundColor: Colors.surface2, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, minHeight: 48, marginBottom: Spacing.sm,
    color: Colors.text, fontFamily: Fonts.body, fontSize: 16,
  },
  pickRow: { paddingVertical: Spacing.md, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border, gap: 2 },
});
