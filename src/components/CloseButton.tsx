import { TouchableOpacity, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';

interface Props {
  onPress: () => void;
  label?: string; // optional text like "Cancel" or "Done"
  color?: string;
}

export function CloseButton({ onPress, label, color }: Props) {
  if (label) {
    return (
      <TouchableOpacity
        onPress={onPress}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ padding: 8 }}
      >
        <Text style={{ color: color ?? Colors.accent, fontWeight: '700', fontSize: 15 }}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: Colors.surface2,
        borderWidth: 1, borderColor: Colors.border,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={{ color: Colors.textMuted, fontSize: 18, lineHeight: 20 }}>×</Text>
    </TouchableOpacity>
  );
}
