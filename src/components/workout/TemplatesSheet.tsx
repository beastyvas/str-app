import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Button, EmptyState, SheetModal } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  templates: any[];
  onAdd: (tmpl: any) => void;
  onClose: () => void;
}

/** Saved templates, viewable mid-workout without leaving the session. */
export function TemplatesSheet({ visible, templates, onAdd, onClose }: Props) {
  return (
    <SheetModal visible={visible} onClose={onClose} title="Your templates" snapHeight={520}>
      <ScrollView contentContainerStyle={styles.list}>
        {templates.length === 0 && <EmptyState icon="note" title="No saved templates yet" />}
        {templates.map((tmpl, i) => (
          <View key={tmpl.id} style={[styles.row, i > 0 && styles.divider]}>
            <View style={styles.flex}>
              <AppText variant="heading" numberOfLines={1}>{tmpl.name}</AppText>
              <AppText variant="caption" numberOfLines={2}>
                {(tmpl.exercises as any[]).map((e: any) => e.name).join(' · ')}
              </AppText>
            </View>
            <Button label="Add" variant="tinted" size="sm" onPress={() => onAdd(tmpl)} />
          </View>
        ))}
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: Spacing.xl, backgroundColor: Colors.surface, borderRadius: Radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, minHeight: 60 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.border },
  flex: { flex: 1, gap: 2 },
});
