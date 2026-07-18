// Temporary PR0 smoke check — proves the Reanimated 4 + worklets toolchain
// compiles a worklet through babel. Deleted once the first real primitive
// (SheetModal) imports reanimated. Not rendered anywhere.
import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

export function useSmokeSpring() {
  const v = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: v.value }],
  }));
  const kick = () => { v.value = withSpring(1, { damping: 18 }); };
  return { style, kick };
}
