import { TextInput, View } from 'react-native';
import { AppText, Button } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { ob } from './styles';

interface Props {
  displayName: string;
  username: string;
  onChangeName: (v: string) => void;
  onChangeUsername: (v: string) => void;
  onNext: () => void;
}

/** 1 · "What should we call you?" — display name + optional username. */
export function NameStep({ displayName, username, onChangeName, onChangeUsername, onNext }: Props) {
  return (
    <View style={ob.step}>
      <View style={ob.head}>
        <AppText variant="display">What should we call you?</AppText>
        <AppText variant="body">Your name shows on your profile and in the feed.</AppText>
      </View>
      <View style={ob.field}>
        <AppText variant="label">Name</AppText>
        <TextInput
          value={displayName}
          onChangeText={onChangeName}
          placeholder="Your name"
          placeholderTextColor={Colors.textMuted}
          autoFocus
          returnKeyType="next"
          style={ob.input}
        />
      </View>
      <View style={ob.field}>
        <AppText variant="label">Username (optional)</AppText>
        <View style={ob.inputRow}>
          <AppText variant="heading" color={Colors.textMuted}>@</AppText>
          <TextInput
            value={username}
            onChangeText={v => onChangeUsername(v.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
            placeholder="handle"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={ob.inputBare}
          />
        </View>
        <AppText variant="caption">Friends find you with @{username || 'handle'}</AppText>
      </View>
      <View style={ob.footer}>
        <Button label="Continue" size="lg" fullWidth onPress={onNext} disabled={!displayName.trim()} />
      </View>
    </View>
  );
}
