import { StyleSheet, TextInput, View } from 'react-native';
import { Button, SheetModal } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  note: string;
  onChange: (v: string) => void;
  onClose: () => void;
}

/** Per-set note — the coach reads these. */
export function SetNoteSheet({ visible, note, onChange, onClose }: Props) {
  return (
    <SheetModal visible={visible} onClose={onClose} title="Set note">
      <View style={styles.body}>
        <TextInput
          value={note}
          onChangeText={onChange}
          autoFocus
          multiline
          placeholder="Shoulder felt tight, bar path was off, felt strong…"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
        />
        <Button label="Done" onPress={onClose} fullWidth />
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.md },
  input: {
    backgroundColor: Colors.surface2, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    color: Colors.text, fontFamily: Fonts.body, fontSize: 16, lineHeight: 22, minHeight: 96, maxHeight: 180, textAlignVertical: 'top',
  },
});
