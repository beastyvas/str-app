import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Radius, Shadow, Spacing } from '@/constants/theme';
import { AppText } from './AppText';
import { IconSymbol, IconName } from './IconSymbol';
import { PressableScale, HapticLevel } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'tinted';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  haptic?: HapticLevel;
  fullWidth?: boolean;
}

const SIZE = {
  sm: { padV: 8, padH: 14, font: 13, icon: 14 },
  md: { padV: 12, padH: 18, font: 14, icon: 16 },
  lg: { padV: 16, padH: 22, font: 16, icon: 18 },
} as const;

const TEXT_COLOR: Record<Variant, string> = {
  primary: '#141210',
  secondary: Colors.text,
  ghost: Colors.textSecondary,
  danger: Colors.danger,
  tinted: Colors.accent,
};

export function Button({
  label, onPress, variant = 'primary', size = 'md', icon,
  loading, disabled, haptic = 'light', fullWidth,
}: ButtonProps) {
  const s = SIZE[size];
  const dim = disabled || loading;

  const inner = (
    <View style={[styles.row, { paddingVertical: s.padV, paddingHorizontal: s.padH }]}>
      {loading ? (
        <ActivityIndicator size="small" color={TEXT_COLOR[variant]} />
      ) : (
        <>
          {icon && <IconSymbol name={icon} size={s.icon} color={TEXT_COLOR[variant]} />}
          <AppText
            variant="heading"
            color={TEXT_COLOR[variant]}
            style={{ fontSize: s.font, letterSpacing: -0.2 }}
          >
            {label}
          </AppText>
        </>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={dim}
      haptic={haptic}
      style={[
        styles.base,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.dangerB,
        variant === 'tinted' && styles.tinted,
        variant === 'primary' && !dim && Shadow.glow(Colors.accent),
        fullWidth && styles.fullWidth,
        dim && styles.dim,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={Gradients.brass}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradient}
        >
          {inner}
        </LinearGradient>
      ) : inner}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: Radius.lg, overflow: 'hidden', alignSelf: 'flex-start' },
  fullWidth: { alignSelf: 'stretch' },
  gradient: { borderRadius: Radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  secondary: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.borderLight },
  ghost: { borderWidth: 1, borderColor: Colors.border },
  dangerB: { borderWidth: 1, borderColor: Colors.danger + '60', backgroundColor: Colors.dangerDim },
  tinted: { backgroundColor: Colors.accentDim, borderWidth: 1, borderColor: Colors.accent + '50' },
  dim: { opacity: 0.5 },
});
