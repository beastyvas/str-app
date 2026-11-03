import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText, Button, IconSymbol, StatTile } from '@/components/ui';
import { MangaPanel, formatPower } from '@/components/anime';
import { UserBadges } from '@/components/UserBadges';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { ROMAN } from '@/constants/ranks';
import { useWorld } from '@/theme';
import { fmtVolume, type WeightUnit } from '@/lib/units';
import type { PowerReading } from '@/lib/powerLevel';

interface Props {
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  badges: { isPro?: boolean | null; isOwner?: boolean | null; isOg?: boolean | null };
  bio?: string | null;
  power: PowerReading | null;
  stats: { workouts: number; volume: number; streak: number; friends: number } | null;
  unit: WeightUnit;
  uploading: boolean;
  onAvatar: () => void;
  onSaveBio: (bio: string) => Promise<void>;
  onOpenLadder: () => void;
  onShowQR: () => void;
}

/** Profile hero: avatar, name, Power Level and rank chip — then one stat row. */
export function ProfileHero({
  name, username, avatarUrl, badges, bio, power, stats, unit, uploading,
  onAvatar, onSaveBio, onOpenLadder, onShowQR,
}: Props) {
  const world = useWorld();
  const [editingBio, setEditingBio] = useState(false);
  const [draft, setDraft] = useState(bio ?? '');
  const rank = power && power.confidence !== 'calibrating' ? power.rank : null;

  return (
    <MangaPanel motif="hero">
      <View style={styles.top}>
        <TouchableOpacity onPress={onAvatar} disabled={uploading} accessibilityLabel="Change profile photo">
          <View style={[styles.avatar, { borderColor: world.aura }]}>
            {uploading ? <ActivityIndicator color={world.aura} />
              : avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.img} cachePolicy="disk" transition={150} />
              : <AppText variant="title" color={world.aura}>{name.charAt(0).toUpperCase()}</AppText>}
          </View>
          <View style={styles.cam}><IconSymbol name="camera" size={11} color={Colors.textSecondary} /></View>
        </TouchableOpacity>
        <View style={styles.flex}>
          <AppText variant="title" numberOfLines={1}>{name}</AppText>
          {username ? <AppText variant="label" color={world.aura}>@{username}</AppText> : null}
          <UserBadges isPro={!!badges.isPro} isOwner={!!badges.isOwner} isOg={!!badges.isOg} size="sm" />
        </View>
      </View>

      <TouchableOpacity onPress={onOpenLadder} style={styles.powerRow} accessibilityLabel="Open rank ladder">
        <View>
          <AppText variant="caption">Power level</AppText>
          <AppText variant="power" style={styles.power}>
            {power && power.confidence !== 'calibrating'
              ? `${power.confidence === 'partial' ? '≈' : ''}${formatPower(power.power)}`
              : '—'}
          </AppText>
        </View>
        <View style={[styles.rankChip, { borderColor: rank?.tier.color ?? Colors.border }]}>
          <AppText variant="heading" color={rank?.tier.color ?? Colors.textMuted} style={styles.rankText}>
            {rank ? `${rank.tier.label} ${ROMAN[rank.subTier]}` : 'Calibrating'}
          </AppText>
        </View>
      </TouchableOpacity>

      {stats && (
        <View style={styles.stats}>
          <StatTile label="Workouts" value={stats.workouts} />
          <StatTile label="Volume" value={fmtVolume(stats.volume, unit)} />
          <StatTile label="Streak" value={`${stats.streak}d`} />
          <StatTile label="Friends" value={stats.friends} />
        </View>
      )}

      {editingBio ? (
        <View style={styles.bioEdit}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            autoFocus
            multiline
            maxLength={150}
            placeholder="Add a bio"
            placeholderTextColor={Colors.textMuted}
            style={styles.bioInput}
          />
          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" size="sm" onPress={() => { setEditingBio(false); setDraft(bio ?? ''); }} />
            <Button label="Save bio" size="sm" onPress={async () => { await onSaveBio(draft); setEditingBio(false); }} />
          </View>
        </View>
      ) : (
        <TouchableOpacity onPress={() => { setDraft(bio ?? ''); setEditingBio(true); }} style={styles.bio} accessibilityLabel="Edit bio">
          <AppText variant="body" color={bio ? Colors.textSecondary : Colors.textMuted} style={styles.flex}>{bio || 'Add a bio'}</AppText>
          <IconSymbol name="edit" size={13} color={Colors.textMuted} />
        </TouchableOpacity>
      )}

      <View style={styles.actions}>
        <Button label="My QR code" icon="qr" variant="tinted" size="sm" onPress={onShowQR} />
      </View>
    </MangaPanel>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  cam: {
    position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.bg, alignItems: 'center', justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  powerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: Spacing.lg, gap: Spacing.md },
  power: { fontSize: 44, lineHeight: 48 },
  rankChip: { borderWidth: 2, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, marginBottom: Spacing.xs },
  rankText: { fontFamily: Fonts.display, fontSize: 15 },
  stats: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  bio: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.sm, minHeight: 32 },
  bioEdit: { gap: Spacing.sm, marginTop: Spacing.sm },
  bioInput: {
    backgroundColor: Colors.surface2, borderRadius: Radius.lg, padding: Spacing.md,
    color: Colors.text, fontFamily: Fonts.body, fontSize: 15, lineHeight: 21, minHeight: 64,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end', marginTop: Spacing.sm },
});
