import { Modal, StyleSheet, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { AppText, Button } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';

/**
 * Full-screen camera for scanning a friend's QR. A camera viewfinder, not a
 * bottom sheet — so it stays a full-screen Modal (fade, not slide).
 */
export function QRScanner({ visible, onScan, onClose }: { visible: boolean; onScan: (data: string) => void; onClose: () => void }) {
  const world = useWorld();
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        <CameraView onBarcodeScanned={({ data }) => onScan(data)} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} style={styles.flex} />
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={[styles.window, { borderColor: world.aura }]} />
          <AppText variant="heading">Point at a friend's STR QR code</AppText>
          <Button label="Close" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.ink },
  flex: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: Spacing.xl, backgroundColor: Colors.ink + '66' },
  window: { width: 260, height: 260, borderWidth: 2 },
});
