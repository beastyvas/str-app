# UI primitives — the rules

1. New/redesigned code uses these primitives + `StyleSheet.create` + tokens
   from `@/constants/theme` (`Spacing`, `Radius`, `Type`, `Shadow`,
   `Gradients`). No new inline style objects, no new raw hex, no new
   emoji-as-icon (`IconSymbol` owns chrome icons; emoji that are *content* —
   toasts, coach messages, session badges — may stay).
2. Untouched screens stay byte-identical. A screen converts wholesale in its
   own redesign PR — never partially from another PR.
3. Sub-components extracted from a screen go to `src/components/<screen>/`.
4. Bottom sheets use `SheetModal` — never `Modal animationType="slide"`.
5. `colors.ts` is read-only: 6-digit hex only, alpha via string concat.
