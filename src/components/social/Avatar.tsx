import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText } from '@/components/ui';
import { Colors } from '@/constants/theme';

export function Avatar({ url, name, color, size = 40 }: { url?: string | null; name: string; color: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const dims = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.wrap, dims, { borderColor: color }]}>
      {url
        ? <Image source={{ uri: url }} style={dims} cachePolicy="disk" transition={150} />
        : <AppText variant="label" color={color} style={{ fontSize: size * 0.32 }}>{initials}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1.5, backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
