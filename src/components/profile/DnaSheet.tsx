import { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { AppText, Button, SheetModal } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

interface Props {
  visible: boolean;
  userId: string;
  initial: string | null | undefined;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

/** Training DNA — free text the coach reads before every response. */
export function DnaSheet({ visible, userId, initial, onClose, onSaved }: Props) {
  const [text, setText] = useState(initial ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible) setText(initial ?? ''); }, [visible]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('users').update({ training_notes: text.trim() || null }).eq('id', userId);
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    await onSaved();
    onClose();
  };

  return (
    <SheetModal visible={visible} onClose={onClose} title="Training DNA">
      <View style={styles.body}>
        <AppText variant="body">History, injuries, what works, weak points, lifestyle. The more detail, the sharper your coach.</AppText>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
          placeholder="Start writing"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
        />
        <Button label="Save" onPress={save} loading={saving} fullWidth size="lg" />
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.md },
  input: {
    backgroundColor: Colors.surface2, borderRadius: Radius.lg, padding: Spacing.lg, minHeight: 200, maxHeight: 320,
    color: Colors.text, fontFamily: Fonts.body, fontSize: 15, lineHeight: 22, textAlignVertical: 'top',
  },
});
