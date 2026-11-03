import { StyleProp, StyleSheet, Text, ViewStyle, View } from 'react-native';
import { Colors, Type } from '@/constants/theme';

interface SfxLayerProps {
  /** Japanese onomatopoeia, e.g. ドン / ゴゴゴ / ズン */
  text: string;
  /** 72–140 */
  size?: number;
  /** 0.08–0.15 */
  opacity?: number;
  color?: string;
  /** Degrees; −6 by default */
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}

/** Big SFX lettering placed BEHIND hero content. Never takes touches. */
export function SfxLayer({ text, size = 110, opacity = 0.1, color = Colors.text, rotate = -6, style }: SfxLayerProps) {
  return (
    <View pointerEvents="none" style={[styles.fill, style]}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[
          styles.text,
          { fontSize: size, lineHeight: size * 1.15, opacity, color, transform: [{ rotate: `${rotate}deg` }] },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { fontFamily: Type.sfx.fontFamily },
});
