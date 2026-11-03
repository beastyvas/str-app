import { TextInput, View } from 'react-native';
import { AppText, Button } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { Chip } from './Chip';
import { ob } from './styles';

export type Standards = 'male' | 'female';

interface Props {
  bodyweight: string;
  unit: 'lbs' | 'kg';
  standards: Standards;
  onChangeBodyweight: (v: string) => void;
  onChangeUnit: (u: 'lbs' | 'kg') => void;
  onChangeStandards: (s: Standards) => void;
  onNext: () => void;
}

/** 2 · "Your body" — bodyweight (big HUD numerals) + optional standards toggle. */
export function BodyStep({
  bodyweight, unit, standards, onChangeBodyweight, onChangeUnit, onChangeStandards, onNext,
}: Props) {
  const valid = parseFloat(bodyweight) > 0;
  return (
    <View style={ob.step}>
      <View style={ob.head}>
        <AppText variant="display">Your body</AppText>
        <AppText variant="body">Your Power Level is measured against people your size.</AppText>
      </View>
      <View style={ob.field}>
        <View style={ob.inputRow}>
          <TextInput
            value={bodyweight}
            onChangeText={v => onChangeBodyweight(v.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad"
            autoFocus
            maxLength={5}
            style={ob.bigNumber}
            accessibilityLabel={`Bodyweight in ${unit}`}
          />
        </View>
        <View style={ob.segment}>
          <Chip label="lbs" selected={unit === 'lbs'} onPress={() => onChangeUnit('lbs')} />
          <Chip label="kg" selected={unit === 'kg'} onPress={() => onChangeUnit('kg')} />
        </View>
      </View>
      <View style={ob.field}>
        <AppText variant="label">Strength standards</AppText>
        <View style={ob.segment}>
          <Chip label="Men's" selected={standards === 'male'} onPress={() => onChangeStandards('male')} />
          <Chip label="Women's" selected={standards === 'female'} onPress={() => onChangeStandards('female')} />
        </View>
      </View>
      <View style={ob.footer}>
        <Button label="Continue" size="lg" fullWidth onPress={onNext} disabled={!valid} />
      </View>
    </View>
  );
}
