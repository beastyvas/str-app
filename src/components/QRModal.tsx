import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Alert, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { Colors } from '@/constants/colors';

interface Props {
  visible: boolean;
  userId: string;
  username?: string;
  displayName: string;
  tierLabel?: string;
  tierColor?: string;
  onClose: () => void;
}

export function QRModal({ visible, userId, username, displayName, tierLabel, tierColor, onClose }: Props) {
  // QR encodes the user ID — the app deep links to their profile
  const qrValue = `str://profile/${userId}`;
  const shareHandle = username ? `@${username}` : displayName;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Find me on STR: ${shareHandle}\n\nDownload STR: Strength Tracker from the App Store`,
        title: 'Add me on STR',
      });
    } catch (e) {
      // user cancelled
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: 20, paddingVertical: 16,
          borderBottomWidth: 1, borderBottomColor: Colors.border,
        }}>
          <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '800' }}>My QR Code</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontSize: 18 }}>×</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 24 }}>
          {/* Tier badge */}
          {tierLabel && (
            <View style={{
              backgroundColor: (tierColor ?? Colors.accent) + '20',
              borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6,
              borderWidth: 1, borderColor: (tierColor ?? Colors.accent) + '40',
            }}>
              <Text style={{ color: tierColor ?? Colors.accent, fontWeight: '800', fontSize: 12, letterSpacing: 2 }}>
                {tierLabel}
              </Text>
            </View>
          )}

          <Text style={{ color: Colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
            {displayName}
          </Text>
          {username && (
            <Text style={{ color: Colors.accent, fontSize: 16, fontWeight: '700', marginTop: -16 }}>
              @{username}
            </Text>
          )}

          {/* QR Code */}
          <View style={{
            backgroundColor: Colors.text,
            padding: 20,
            borderRadius: 20,
          }}>
            <QRCode
              value={qrValue}
              size={220}
              color={Colors.bg}
              backgroundColor={Colors.text}
            />
          </View>

          <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
            Have a friend scan this in the gym to instantly add you on STR
          </Text>

          {/* Share button */}
          <TouchableOpacity
            onPress={handleShare}
            style={{
              backgroundColor: Colors.accent,
              borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: Colors.text, fontWeight: '800', fontSize: 15 }}>Share Profile →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
