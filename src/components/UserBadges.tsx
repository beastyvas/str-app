import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { IconSymbol, type IconName } from '@/components/ui/IconSymbol';
import { Colors, Fonts } from '@/constants/theme';

interface Props {
  isOwner?: boolean;
  isOg?: boolean;
  isPro?: boolean;
  size?: 'sm' | 'md';
  onPressPro?: () => void;
}

function Badge({ label, icon, color, size }: { label: string; icon: IconName; color: string; size: 'sm' | 'md' }) {
  return (
    <View style={[styles.badge, size === 'sm' && styles.sm, { borderColor: color + '66', backgroundColor: color + '1F' }]}>
      <IconSymbol name={icon} size={size === 'sm' ? 10 : 12} color={color} />
      <AppText style={[styles.text, size === 'sm' && styles.textSm, { color }]}>{label}</AppText>
    </View>
  );
}

/** Pro / Creator / OG chips. */
export function UserBadges({ isOwner, isOg, isPro, size = 'md', onPressPro }: Props) {
  if (!isOwner && !isOg && !isPro) return null;
  const pro = <Badge label="Pro" icon="flash" color={Colors.badgePro} size={size} />;
  return (
    <View style={styles.row}>
      {isPro && !isOwner && (onPressPro ? <TouchableOpacity onPress={onPressPro} activeOpacity={0.7}>{pro}</TouchableOpacity> : pro)}
      {isOwner && <Badge label="Creator" icon="crown" color={Colors.gold} size={size} />}
      {isOg && <Badge label="OG" icon="medal" color={Colors.badgeOg} size={size} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  sm: { paddingHorizontal: 5, paddingVertical: 2 },
  text: { fontFamily: Fonts.bodySemi, fontSize: 11, lineHeight: 14 },
  textSm: { fontSize: 10, lineHeight: 13 },
});
