import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing, onColor } from '@/constants/theme';
import { useWorld } from '@/theme';
import { AppText, Button, SheetModal } from '@/components/ui';

interface WeeklyPlanSheetProps {
  visible: boolean;
  trainingDays: string;
  onChangeDays: (d: string) => void;
  onBuild: () => void;
  onClose: () => void;
}

export function WeeklyPlanSheet({ visible, trainingDays, onChangeDays, onBuild, onClose }: WeeklyPlanSheetProps) {
  const world = useWorld();
  return (
    <SheetModal visible={visible} onClose={onClose} title="Build your weekly plan">
      <View style={styles.body}>
        <AppText variant="body" style={styles.sub}>
          Coach will build you a full week of training based on your goals. This uses one of your free Coach asks.
        </AppText>

        <View>
          <AppText variant="label" style={styles.fieldLabel}>
            How many days per week can you train?
          </AppText>
          <View style={styles.daysRow}>
            {['2', '3', '4', '5', '6'].map(d => (
              <TouchableOpacity
                key={d}
                onPress={() => onChangeDays(d)}
                style={[styles.dayBtn, trainingDays === d ? { backgroundColor: world.aura, borderColor: world.aura } : styles.dayBtnIdle]}
              >
                <AppText variant="stat" color={trainingDays === d ? onColor(world.aura) : Colors.text}>{d}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Button label="Build my plan (uses 1 ask)" onPress={onBuild} fullWidth size="lg" />
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.lg },
  sub: { marginTop: -Spacing.sm },
  fieldLabel: { marginBottom: 10 },
  daysRow: { flexDirection: 'row', gap: 10 },
  dayBtn: {
    flex: 1, minHeight: 48, justifyContent: 'center', borderRadius: Radius.lg,
    alignItems: 'center', borderWidth: 1,
  },
  dayBtnIdle: { backgroundColor: Colors.surface2, borderColor: Colors.border },
});
