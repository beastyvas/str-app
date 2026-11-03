import { StyleSheet } from 'react-native';
import { Colors, Fonts, Hit, Radius, Spacing } from '@/constants/theme';

/**
 * The set grid shared by the header, logged rows and the input row:
 * set # · last · weight · × · reps · check. Chakra Petch numerals, ≥56pt rows.
 */
export const grid = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, minHeight: Hit.log },
  setNo: { width: 26, textAlign: 'center' },
  last: { width: 64, alignItems: 'center' },
  weight: { flex: 1.4 },
  times: { width: 12, textAlign: 'center' },
  reps: { flex: 1 },
  check: { width: Hit.log, alignItems: 'center' },
  input: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    color: Colors.text,
    fontFamily: Fonts.hudBold,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    minHeight: 48,
    paddingVertical: 0,
  },
  inputBox: { alignItems: 'center', justifyContent: 'center' },
});
