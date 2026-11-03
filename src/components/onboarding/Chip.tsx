import { AppText, PressableScale } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { useWorld } from '@/theme';
import { ob } from './styles';

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const world = useWorld();
  return (
    <PressableScale
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[ob.chip, selected && { borderColor: world.aura, backgroundColor: world.aura + '1F' }]}
    >
      <AppText variant="heading" color={selected ? world.aura : Colors.textSecondary}>{label}</AppText>
    </PressableScale>
  );
}
