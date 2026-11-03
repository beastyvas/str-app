import { Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AppText, Button, SheetModal } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';

interface Props {
  visible: boolean;
  userId: string;
  username?: string;
  displayName: string;
  tierLabel?: string;
  tierColor?: string;
  onClose: () => void;
}

/** My QR code — friends scan it to add you. */
export function QRModal({ visible, userId, username, displayName, tierLabel, tierColor, onClose }: Props) {
  const world = useWorld();
  // QR encodes the user ID — the app deep links to their profile
  const qrValue = `str://profile/${userId}`;
  const share = async () => {
    try {
      await Share.share({ message: `Find me on STR: ${username ? `@${username}` : displayName}`, title: 'Add me on STR' });
    } catch {
      // cancelled
    }
  };

  return (
    <SheetModal visible={visible} onClose={onClose} title="My QR code" keyboardAware={false}>
      <View style={styles.body}>
        <View style={styles.center}>
          {tierLabel && <AppText variant="heading" color={tierColor ?? world.aura} style={styles.tier}>{tierLabel}</AppText>}
          <AppText variant="title">{displayName}</AppText>
          {username && <AppText variant="label" color={world.aura}>@{username}</AppText>}
        </View>
        <View style={[styles.qr, { borderColor: world.aura }]}>
          <QRCode value={qrValue} size={200} color={Colors.bg} backgroundColor={Colors.paper} />
        </View>
        <AppText variant="caption" style={styles.centerText}>Have a friend scan this to add you on STR.</AppText>
        <Button label="Share profile" icon="share" onPress={share} fullWidth size="lg" />
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.lg, alignItems: 'center' },
  center: { alignItems: 'center', gap: Spacing.xs },
  tier: { fontFamily: Fonts.display },
  qr: { backgroundColor: Colors.paper, padding: Spacing.lg, borderWidth: 2 },
  centerText: { textAlign: 'center' },
});
