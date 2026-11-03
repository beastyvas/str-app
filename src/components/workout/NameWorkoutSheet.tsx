import { StyleSheet, TextInput, View } from 'react-native';
import { Button, SheetModal } from '@/components/ui';
import { Colors, Fonts, Hit, Radius, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  title: string;
  confirmLabel: string;
  name: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

/** Name a workout — used to start one, and to rename the active one. */
export function NameWorkoutSheet({ visible, title, confirmLabel, name, onChange, onConfirm, onClose }: Props) {
  return (
    <SheetModal visible={visible} onClose={onClose} title={title}>
      <View style={styles.body}>
        <TextInput
          value={name}
          onChangeText={onChange}
          autoFocus
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={() => name.trim() && onConfirm()}
          style={styles.input}
          accessibilityLabel="Workout name"
        />
        <Button label={confirmLabel} onPress={onConfirm} disabled={!name.trim()} fullWidth size="lg" haptic="medium" />
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.md },
  input: {
    backgroundColor: Colors.surface2, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.lg, minHeight: Hit.log, color: Colors.text, fontFamily: Fonts.bodySemi, fontSize: 18,
  },
});
