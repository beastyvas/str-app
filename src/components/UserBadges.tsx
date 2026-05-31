import { View, Text } from 'react-native';
import { Colors } from '@/constants/colors';

interface Props {
  isOwner?: boolean;
  isOg?: boolean;
  size?: 'sm' | 'md';
}

export function UserBadges({ isOwner, isOg, size = 'md' }: Props) {
  if (!isOwner && !isOg) return null;
  const fontSize = size === 'sm' ? 9 : 10;
  const px = size === 'sm' ? 5 : 7;
  const py = size === 'sm' ? 2 : 3;

  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
      {isOwner && (
        <View style={{
          backgroundColor: Colors.gold + '25',
          borderRadius: 6, paddingHorizontal: px, paddingVertical: py,
          borderWidth: 1, borderColor: Colors.gold + '50',
        }}>
          <Text style={{ color: Colors.gold, fontSize, fontWeight: '900', letterSpacing: 0.3 }}>
            👑 CREATOR
          </Text>
        </View>
      )}
      {isOg && !isOwner && (
        <View style={{
          backgroundColor: '#FF6B0025',
          borderRadius: 6, paddingHorizontal: px, paddingVertical: py,
          borderWidth: 1, borderColor: '#FF6B0060',
        }}>
          <Text style={{ color: '#FF6B00', fontSize, fontWeight: '900', letterSpacing: 0.3 }}>
            ⚡ OG
          </Text>
        </View>
      )}
      {isOg && isOwner && (
        <View style={{
          backgroundColor: '#FF6B0025',
          borderRadius: 6, paddingHorizontal: px, paddingVertical: py,
          borderWidth: 1, borderColor: '#FF6B0060',
        }}>
          <Text style={{ color: '#FF6B00', fontSize, fontWeight: '900', letterSpacing: 0.3 }}>
            ⚡ OG
          </Text>
        </View>
      )}
    </View>
  );
}
