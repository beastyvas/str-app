import { StyleSheet } from 'react-native';
import { Colors, Fonts, Hit, Radius, Spacing } from '@/constants/theme';

/** Shared onboarding styles — every step uses the same rhythm. */
export const ob = StyleSheet.create({
  step: { flex: 1, gap: Spacing.xxl },
  head: { gap: Spacing.sm },
  field: { gap: Spacing.sm },
  input: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.lg,
    minHeight: Hit.log,
    color: Colors.text,
    fontFamily: Fonts.bodySemi,
    fontSize: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingLeft: Spacing.lg,
    minHeight: Hit.log,
  },
  inputBare: { flex: 1, color: Colors.text, fontFamily: Fonts.bodySemi, fontSize: 18, paddingHorizontal: Spacing.xs, minHeight: Hit.log },
  bigNumber: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.hudBold,
    fontSize: 56,
    minHeight: 84,
    paddingHorizontal: Spacing.lg,
  },
  segment: { flexDirection: 'row', gap: Spacing.sm },
  chip: {
    flex: 1,
    minHeight: Hit.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  footer: { gap: Spacing.md, marginTop: 'auto' },
  center: { alignItems: 'center' },
});
