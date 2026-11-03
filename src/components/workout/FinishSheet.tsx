import { Alert, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { AppText, Button, IconSymbol, SheetModal, StatTile } from '@/components/ui';
import { Colors, Fonts, Hit, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { fmtVolume, toDisplay, type WeightUnit } from '@/lib/units';

export interface FinishDraft {
  notes: string;
  photo: string | null;
  saveAsTemplate: boolean;
  templateName: string;
}

interface Props {
  visible: boolean;
  workoutName: string;
  duration: string;
  totalSets: number;
  totalVolume: number;
  prs: { exerciseName: string; weight: number; reps: number }[];
  unit: WeightUnit;
  draft: FinishDraft;
  onChange: (patch: Partial<FinishDraft>) => void;
  finishing: boolean;
  onFinish: (quick: boolean) => void;
  onClose: () => void;
}

/** Confirm + post: stats, PRs, optional photo and caption, save as template. */
export function FinishSheet({
  visible, workoutName, duration, totalSets, totalVolume, prs, unit, draft, onChange, finishing, onFinish, onClose,
}: Props) {
  const world = useWorld();

  const pickPhoto = () => {
    Alert.alert('Add photo', undefined, [
      {
        text: 'Take photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Camera permission needed'); return; }
          const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.7 });
          if (!r.canceled && r.assets[0]) onChange({ photo: r.assets[0].uri });
        },
      },
      {
        text: 'Choose from library',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert('Photo library permission needed'); return; }
          const r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.7,
          });
          if (!r.canceled && r.assets[0]) onChange({ photo: r.assets[0].uri });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SheetModal visible={visible} onClose={onClose} title="Finish workout">
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <AppText variant="heading" numberOfLines={1}>{workoutName}</AppText>
        <View style={styles.stats}>
          <StatTile label="Duration" value={duration} />
          <StatTile label="Sets" value={totalSets} />
          <StatTile label="Volume" value={fmtVolume(totalVolume, unit)} />
        </View>

        {prs.length > 0 && (
          <View style={styles.prs}>
            {prs.map((p, i) => (
              <View key={i} style={styles.prRow}>
                <View style={[styles.prChip, { backgroundColor: world.aura }]}>
                  <AppText variant="label" color={Colors.bg}>PR</AppText>
                </View>
                <AppText variant="body" color={Colors.text} style={styles.flex} numberOfLines={1}>{p.exerciseName}</AppText>
                <AppText variant="stat" style={styles.prValue}>{toDisplay(p.weight, unit)} × {p.reps}</AppText>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity onPress={pickPhoto} activeOpacity={0.85} style={[styles.photo, draft.photo ? styles.photoOn : null]}>
          {draft.photo ? (
            <Image source={{ uri: draft.photo }} style={styles.img} contentFit="cover" />
          ) : (
            <View style={styles.photoEmpty}>
              <IconSymbol name="camera" size={22} color={Colors.textMuted} />
              <AppText variant="label">Add a photo</AppText>
            </View>
          )}
        </TouchableOpacity>
        {draft.photo && <Button label="Remove photo" variant="ghost" size="sm" onPress={() => onChange({ photo: null })} />}

        <TextInput
          value={draft.notes}
          onChangeText={notes => onChange({ notes })}
          placeholder="Add a caption (optional)"
          placeholderTextColor={Colors.textMuted}
          multiline
          style={styles.caption}
        />

        <View style={styles.switchRow}>
          <AppText variant="heading" style={styles.flex}>Save as template</AppText>
          <Switch
            value={draft.saveAsTemplate}
            onValueChange={v => onChange({ saveAsTemplate: v, templateName: v && !draft.templateName ? workoutName : draft.templateName })}
            trackColor={{ false: Colors.surface3, true: world.aura }}
          />
        </View>
        {draft.saveAsTemplate && (
          <TextInput
            value={draft.templateName}
            onChangeText={templateName => onChange({ templateName })}
            placeholder="Template name, e.g. Push day"
            placeholderTextColor={Colors.textMuted}
            style={styles.field}
          />
        )}

        <Button label="Finish workout" size="lg" fullWidth onPress={() => onFinish(false)} loading={finishing} haptic="medium" />
        <Button label="Finish without posting details" variant="ghost" fullWidth onPress={() => onFinish(true)} disabled={finishing} />
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.lg, paddingBottom: Spacing.lg },
  stats: { flexDirection: 'row', gap: Spacing.md },
  prs: { gap: Spacing.sm },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  prChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  prValue: { fontSize: 16 },
  flex: { flex: 1 },
  photo: {
    height: 96, borderRadius: Radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderLight,
    backgroundColor: Colors.surface2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  photoOn: { height: 220, borderStyle: 'solid' },
  photoEmpty: { alignItems: 'center', gap: Spacing.xs },
  img: { width: '100%', height: '100%' },
  caption: {
    backgroundColor: Colors.surface2, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    color: Colors.text, fontFamily: Fonts.body, fontSize: 15, lineHeight: 22, minHeight: 72, maxHeight: 140, textAlignVertical: 'top',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: Hit.min },
  field: {
    backgroundColor: Colors.surface2, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, minHeight: 48,
    color: Colors.text, fontFamily: Fonts.body, fontSize: 15,
  },
});
