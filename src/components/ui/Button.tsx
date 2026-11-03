import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Colors, Hit, Radius, Spacing, onColor } from '@/constants/theme';
import { useWorld } from '@/theme';
import { AppText } from './AppText';
import { IconSymbol, IconName } from './IconSymbol';
import { PressableScale, HapticLevel } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'tinted';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  /** Say what it does: "Start workout", "Log set". No arrows. */
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  haptic?: HapticLevel;
  fullWidth?: boolean;
  /** Override the world aura (e.g. a friend's color) */
  color?: string;
}

const SIZE = {
  sm: { h: 36, padH: 14, font: 14, icon: 14 },
  md: { h: Hit.min + 4, padH: 18, font: 16, icon: 16 },
  lg: { h: Hit.log, padH: 22, font: 17, icon: 18 },
} as const;

export function Button({
  label, onPress, variant = 'primary', size = 'md', icon,
  loading, disabled, haptic = 'light', fullWidth, color,
}: ButtonProps) {
  const world = useWorld();
  const aura = color ?? world.aura;
  const s = SIZE[size];
  const dim = disabled || loading;

  const fg =
    variant === 'primary' ? onColor(aura)
    : variant === 'secondary' ? Colors.text
    : variant === 'ghost' ? Colors.textSecondary
    : variant === 'danger' ? Colors.danger
    : aura;

  return (
    <PressableScale
      onPress={onPress}
      disabled={dim}
      haptic={haptic}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.base,
        { minHeight: s.h, paddingHorizontal: s.padH },
        variant === 'primary' && { backgroundColor: aura },
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        variant === 'tinted' && { backgroundColor: aura + '1F', borderColor: aura + '55', borderWidth: 1 },
        fullWidth && styles.fullWidth,
        dim && styles.dim,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <>
            {icon && <IconSymbol name={icon} size={s.icon} color={fg} />}
            <AppText variant="heading" color={fg} style={{ fontSize: s.font }}>{label}</AppText>
          </>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: Radius.lg, alignSelf: 'flex-start', justifyContent: 'center' },
  fullWidth: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  secondary: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.borderLight },
  ghost: { borderWidth: 1, borderColor: Colors.border },
  danger: { borderWidth: 1, borderColor: Colors.danger + '60', backgroundColor: Colors.danger + '1F' },
  dim: { opacity: 0.45 },
});
