# UI primitives — the rules

The app is a shonen anime: each rank tier is a different **world** (Demon
Slayer → My Hero Academia → Jujutsu Kaisen → Dragon Ball → Solo Leveling →
One Punch Man) on one shared **Ink Night** ground.

## Tokens
- `@/constants/colors` — base palette (Ink Night). **6-digit hex only** for
  base keys; call sites concat alpha (`Colors.border + '80'`). `*Dim` keys
  are pre-mixed 8-digit hex: never concat onto them.
- `@/constants/theme` — `Spacing` (8-pt grid, 20 screen padding, `group` 28),
  `Radius` (rows/inputs/buttons = `lg` 14), `Hit` (44 / 56 for set logging),
  `Fonts`, `Type`, `onColor(fill)` (Night vs Ki text by contrast).
- `useWorld()` (`@/theme`) — the active world: `aura`, `auraAlt`, `Motif`,
  `panel`, `sfx`, `powerReadout`, `rankUpScene`, `roster`. **Real code uses
  `useWorld().aura`, never `Colors.accent`** (that's a static fallback).
  `WorldScope` renders a subtree in a specific world.

## Type
Dela Gothic One (`display`, `title`, `sfx`) · Chakra Petch (`power`, `stat`)
· Barlow (`heading`, `body`, `label`, `caption`). Families are per-weight —
never add `fontWeight` to a `Type` style. **There is no `overline`.**
Sentence case everywhere; uppercase only for rank names and Solo Leveling
`[ SYSTEM ]` windows.

## Primitives (`src/components/ui/`)
`AppText` · `Button` (primary = aura fill) · `Card` (plain grouped surface,
no shadow, never nested) · `Screen` (`motifHeader` for a world band) ·
`Section` (optional sentence-case `title`) · `StatTile` (value over label,
no box) · `SheetModal` · `SkeletonBlock` · `IconSymbol` · `PressableScale`
· `EmptyState`.

## Anime layer (`src/components/anime/`)
`MangaPanel` (hero only: one cut corner, 2px aura border) · `PowerReadout`
· `SfxLayer` · `SpeedLines` · `ImpactFrame` (`fireImpact(color, sfx)`) ·
`RankUpScene`. Preview them all at `app/dev/worlds.tsx` (dev builds).

## Rules
1. `StyleSheet.create` + tokens. No new inline style objects, no raw hex
   outside `colors.ts`, `ranks.ts`, and `src/theme/worlds/palette.ts`.
2. **One hero per screen**, framed by the world motif. Everything else is a
   plain grouped list. No card-in-card, no drop shadows.
3. Motifs live in header bands and screen edges — **never behind set rows,
   weights, reps or timers.** If a motif competes with logging, it loses.
4. Motion must answer something (PR, rank change, finish, cameo, sheet).
   Respect Reduce Motion: end state, no flash, no shake.
5. `IconSymbol` owns chrome icons. Emoji only inside character speech.
6. Buttons say what they do ("Start workout"). No `→`.
7. Sub-components extracted from a screen go to `src/components/<screen>/`.
8. Bottom sheets use `SheetModal` — never `Modal animationType="slide"`.
