import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { AppText, Button, SheetModal } from '@/components/ui';
import { Colors, Fonts, Hit, Radius, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';
import { supabase } from '@/lib/supabase';
import { screenText } from '@/lib/contentFilter';
import { toLbs } from '@/lib/units';
import type { UserRow } from '@/lib/database.types';

interface Props {
  visible: boolean;
  profile: UserRow | null;
  userId: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

/** Name, username, units, bodyweight. */
export function EditProfileSheet({ visible, profile, userId, onClose, onSaved }: Props) {
  const world = useWorld();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
  const [bw, setBw] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const u = profile?.unit_pref ?? 'lbs';
    setName(profile?.display_name ?? '');
    setUsername(profile?.username ?? '');
    setUnit(u);
    setBw(profile?.bodyweight_lbs ? String(u === 'kg' ? Math.round((profile.bodyweight_lbs / 2.2046226218) * 10) / 10 : profile.bodyweight_lbs) : '');
    setError('');
  }, [visible]);

  const save = async () => {
    const w = parseFloat(bw);
    if (!w || w < 20) { Alert.alert('Enter a valid bodyweight'); return; }
    const uname = username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
    if (username.trim() && uname.length < 3) { setError('Username must be at least 3 characters'); return; }
    // Objectionable-content screen (Guideline 1.2)
    const issue = screenText(name, 'display name') || screenText(uname, 'username');
    if (issue) { Alert.alert('Not allowed', issue); return; }
    if (uname && uname !== profile?.username) {
      const { data: taken } = await supabase.from('public_profiles').select('id').eq('username', uname).neq('id', userId).maybeSingle();
      if (taken) { setError('That username is already taken'); return; }
    }
    setSaving(true);
    const { error: err } = await supabase.from('users').update({
      display_name: name.trim(),
      bodyweight_lbs: Math.round(toLbs(w, unit) * 10) / 10,
      unit_pref: unit,
      username: uname || null,
    }).eq('id', userId);
    setSaving(false);
    if (err) {
      if (err.code === '23505') setError('That username is already taken');
      else Alert.alert('Error', err.message);
      return;
    }
    await onSaved();
    onClose();
  };

  return (
    <SheetModal visible={visible} onClose={onClose} title="Edit profile">
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <AppText variant="label">Name</AppText>
          <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={Colors.textMuted} />
        </View>
        <View style={styles.field}>
          <AppText variant="label">Username</AppText>
          <TextInput
            value={username}
            onChangeText={v => { setUsername(v); setError(''); }}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="handle"
            placeholderTextColor={Colors.textMuted}
            style={[styles.input, !!error && { borderColor: Colors.danger }]}
          />
          <AppText variant="caption" color={error ? Colors.danger : undefined}>{error || `Friends find you with @${username || 'handle'}`}</AppText>
        </View>
        <View style={styles.field}>
          <AppText variant="label">Units</AppText>
          <View style={styles.segment}>
            {(['lbs', 'kg'] as const).map(u => (
              <TouchableOpacity
                key={u}
                onPress={() => setUnit(u)}
                style={[styles.seg, unit === u && { borderColor: world.aura, backgroundColor: world.aura + '1F' }]}
              >
                <AppText variant="heading" color={unit === u ? world.aura : Colors.textSecondary}>{u}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.field}>
          <AppText variant="label">Bodyweight ({unit})</AppText>
          <TextInput value={bw} onChangeText={setBw} keyboardType="decimal-pad" style={[styles.input, styles.num]} />
        </View>
        <Button label="Save profile" onPress={save} loading={saving} fullWidth size="lg" />
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.lg, paddingBottom: Spacing.lg },
  field: { gap: Spacing.sm },
  input: {
    backgroundColor: Colors.surface2, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.lg, minHeight: 50, color: Colors.text, fontFamily: Fonts.bodySemi, fontSize: 17,
  },
  num: { fontFamily: Fonts.hudBold, fontSize: 22 },
  segment: { flexDirection: 'row', gap: Spacing.sm },
  seg: {
    flex: 1, minHeight: Hit.min, alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface2,
  },
});
