import { StyleSheet, TextInput, View } from 'react-native';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { AppText, Button, SheetModal } from '@/components/ui';

export interface SbdInputs { sq: string; bp: string; dl: string }

interface SbdEntrySheetProps {
  visible: boolean;
  unit: 'lbs' | 'kg';
  inputs: SbdInputs;
  saving: boolean;
  onChange: (inputs: SbdInputs) => void;
  onSave: () => void;
  onClose: () => void;
}

export function SbdEntrySheet({ visible, unit, inputs, saving, onChange, onSave, onClose }: SbdEntrySheetProps) {
  return (
    <SheetModal visible={visible} onClose={onClose} title="Your SBD Maxes">
      <View style={styles.body}>
        <AppText variant="body" style={styles.sub}>
          Enter your best single or a heavy set of 3-5. We'll use this to calculate your tier.
        </AppText>

        {([
          { label: 'Squat', key: 'sq', placeholder: '315' },
          { label: 'Bench', key: 'bp', placeholder: '225' },
          { label: 'Deadlift', key: 'dl', placeholder: '405' },
        ] as const).map(({ label, key, placeholder }) => (
          <View key={key}>
            <AppText variant="overline" style={styles.fieldLabel}>{label} ({unit})</AppText>
            <TextInput
              value={inputs[key]}
              onChangeText={v => onChange({ ...inputs, [key]: v })}
              keyboardType="number-pad"
              placeholder={placeholder}
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
          </View>
        ))}

        <Button
          label="Save & Calculate Tier"
          onPress={onSave}
          loading={saving}
          fullWidth
          size="lg"
        />
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.lg },
  sub: { marginTop: -Spacing.sm },
  fieldLabel: { fontSize: 10, letterSpacing: 1.5, marginBottom: Spacing.sm },
  input: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md + 2,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    ...Type.mono,
  },
});
