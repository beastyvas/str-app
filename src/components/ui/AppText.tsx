import { Text, TextProps } from 'react-native';
import { Type, TypeVariant } from '@/constants/theme';

interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  color?: string;
  /** Tabular numerals — for anything that counts or ticks */
  mono?: boolean;
}

export function AppText({ variant = 'body', color, mono, style, children, ...rest }: AppTextProps) {
  return (
    <Text
      style={[
        Type[variant],
        mono && Type.mono,
        color != null && { color },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
