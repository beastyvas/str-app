# STR — working notes for Claude Code

Social strength-training app. Log lifts, get an AI coach, rank against strength
standards, share sessions with friends.

**Stack:** Expo SDK 54 · React Native 0.81 · Hermes · New Architecture ·
expo-router · TypeScript · Supabase (Postgres + RLS + Edge Functions) ·
RevenueCat (subscriptions) · Zustand (workout store).

---

## Status & branches

**Personal app, TestFlight only.** One user (the owner). It is not on the App
Store and won't be soon, so App Store review concerns (3.1.2(c), EULA in the
description, "Apple-reviewed flows") are not blockers.

`main` is 1.1.0 build 2. The anime rehaul (Power Level, worlds, cameos,
onboarding, every screen) landed on `claude/str-anime-rehaul-sllidq`. There
is no `redesign/v2` branch anymore — it was merged into `main` before 1.1.0.

## Release model — read before shipping anything

`app.json` sets `runtimeVersion.policy = "appVersion"`, so the **app version**
(not `buildNumber`) is what separates OTA update lanes.

The redesign added **native modules** — `react-native-worklets`,
`expo-linear-gradient`, `@shopify/flash-list` — so:

- **1.1.0 must ship as a new binary** (`eas build`). It cannot go out as an
  `eas update`.
- Never publish an OTA update on the 1.0.6 lane from this branch: builds 13/14
  don't contain those native modules and would **crash on launch**. The 1.1.0
  version bump exists specifically to prevent that.
- After 1.1.0 is live, JS-only changes (restyles, copy, logic) ship instantly
  with `eas update`. Only touch `eas build` again when a native dep changes.
- The anime rehaul added **no native modules**: the `@expo-google-fonts/*`
  packages are JS + TTF assets loaded through `expo-font` (already in the
  binary). Fonts are imported per weight in `app/_layout.tsx` — the package
  roots `require` every weight and would bloat every update. Cameo images
  are assets too. So the rehaul ships as an `eas update` on the 1.1.0 lane.
- Cameo tooling (`sharp`, `@imgly/background-removal-node`) lives in
  `scripts/package.json`, NOT the app's package.json, so EAS never installs it.

Locally, `npx expo start` against an old dev client will crash for the same
reason — build fresh: `npx expo run:ios --device`.

## Verification (no test suite exists)

```bash
npx tsc --noEmit                                  # MUST stay at 0 errors
npx expo export --platform ios --output-dir /tmp/verify   # must bundle clean
```

Manual canary after anything non-trivial: paywall opens · onboarding completes ·
workout start → log a set → finish.

---

## Design system

Full rules in `src/components/ui/README.md`. The short version:

- **Fully anime, one world per rank tier.** Mortal = Demon Slayer, Awakened =
  My Hero Academia, Ascendant = Jujutsu Kaisen, Phantom = Dragon Ball,
  Sovereign = Solo Leveling, Godhand = One Punch Man. Worlds live in
  `src/theme/worlds/` (`WorldTheme`: aura, motif, panel, SFX, Power Level
  readout, rank-up scene, cast). `useWorld()` returns the active one;
  `WorldProvider` (in `app/_layout.tsx`) follows the cached rank from
  `useHomeData` via `useWorldStore`, with a Profile override.
- Every world sits on the shared **Ink Night** ground. Style with
  `@/constants/theme` tokens (`Spacing`, `Radius`, `Hit`, `Fonts`, `Type`,
  `onColor`) + `StyleSheet.create` + `src/components/ui/` primitives +
  `src/components/anime/` (`MangaPanel`, `PowerReadout`, `SfxLayer`,
  `SpeedLines`, `ImpactFrame`, `RankUpScene`).
- Fonts: Dela Gothic One (display/SFX), Chakra Petch (numbers/HUD), Barlow
  (body). Per-weight family names are baked into `Type` — no `fontWeight`.
  No `overline` variant; sentence case everywhere.
- `src/constants/colors.ts`: base keys are **6-digit hex only** (call sites
  concat alpha). World colors are in `src/theme/worlds/palette.ts`. Real code
  reads `useWorld().aura`; `Colors.accent` is only a static fallback.
- One hero per screen (a `MangaPanel`), plain grouped lists for the rest. No
  card-in-card, no drop shadows. Motifs never sit behind logging inputs.
- `IconSymbol` owns chrome icons. Emoji only inside character speech.
- Bottom sheets use `SheetModal`. Never add a new `Modal animationType="slide"`.
- Convert a screen to primitives **wholesale in its own commit**.
- Dev builds: `app/dev/worlds.tsx` previews all six worlds.
- **Cameos:** each world has a six-character cast (lead = coach) plus guests
  (Broly, Yujiro, Roshi). Cast IDs live in `src/constants/cast.ts`
  (`TIER_CHARACTER` in `ranks.ts` derives from it); names/colors in
  `castData.json`; lines in `cameoLines.ts`; who-speaks-when in
  `src/lib/cameoEngine.ts` (pure); queue + settings in
  `src/components/cameo/useCameoStore.ts`; `<CameoRoot />` mounts in
  `app/_layout.tsx` (native modals like the summary mount a local `<Cameo
  host="local" />`). Art lives in `assets/cameos/<id>/` — see its README.
  **Never draw or generate character art**; placeholders only.

## Power Level & rank

Spec + hand-checked examples at the top of `src/lib/powerLevel.ts` (pure;
`powerLevelSelfCheck()` runs in `__DEV__`). Epley e1RM from every squat /
bench / deadlift set in 180 days (proxies via a tunable coefficient table;
dumbbell bench is logged per hand → 2.4), continuous position on the 24
scaled thresholds, `power = mean(p) × 375` (9,000 = Godhand IV average).
Rank uses the same e1RMs with the weakest-link rule. Fetching / saving is
`src/lib/powerData.ts`; migration `029_power_level.sql` stores `power_level`,
`power_confidence`, `rank_tier_key`, `rank_sub_tier` and exposes them via
`public_profiles` (the app tolerates 029 not having run).

## Architecture notes

- **Data hooks are stale-while-revalidate.** `useHomeData`,
  `useWorkoutTemplates`, and module-level caches in `app/(tabs)/friends.tsx` and
  `FriendProfileModal.tsx` render cached data instantly on refocus and refresh
  in the background. Skeletons show only on true first load. Don't reintroduce
  blanket refetch-on-focus behind a full-screen spinner.
- **`ElapsedTime.tsx` isolates the workout clock.** The 1s interval lives in
  that leaf so only one `<Text>` re-renders per tick. Do not put a `setInterval`
  at workout-screen scope again — that was re-rendering ~30 components/second.
- `ExerciseCard` / `SetInputRow` / `LoggedSetRow` are `React.memo`'d. Callbacks
  passed to them must be identity-stable (`useStableCallback` in
  `src/lib/useStableCallback.ts`).
- **Load-bearing, don't rewrite:** `src/hooks/useWorkout.ts` (offline queue +
  restore), the Live Activity native module, `TierAdvancementScreen`.

## Don't touch without asking

- Paywall (`PaywallModal`) and RevenueCat wiring: restyle only. EULA and
  First Steps completion semantics: don't change. **Onboarding is freely
  editable** (rewritten to 3 screens + a Power Level reveal; components in
  `src/components/onboarding/`).
- Supabase schema/RLS — always via a new numbered migration.
- **RLS lesson (migrations 026→027):** a policy must never subquery
  `public.users` directly. Own-row RLS applies *inside* policy subqueries, so
  the check silently matches nothing. Use a `SECURITY DEFINER` helper
  (`is_owner_account`, `is_public_profile`) instead.

---

## Open threads

- **Run migration `029_power_level.sql`** (friends' Power Levels and stored
  ranks depend on it; the app works without it). Also confirm `026`–`028`.
- **Redeploy `ai-coach`** — its tier personalities now add each world lead's
  flavor (`supabase functions deploy ai-coach`).
- **`coach-nudge` is dead.** The mid-workout coach banner (`WorkoutCoach`) was
  deleted; nothing calls this edge function. Delete it whenever
  (`supabase functions delete coach-nudge`).
- **Cameo art:** 39 placeholder portraits ship in `assets/cameos/`. Real art
  goes through `node scripts/process-cameos.mjs` (see that folder's README and
  `CAST_CHECKLIST.md`). Never generate character art.
- **`is_owner` is unset** for the creator account. It gates the creator
  showcase, auto-accept-friend (migration 012), and the owner badge — all
  silently no-op until someone runs
  `UPDATE public.users SET is_owner = true, is_og = true WHERE email = '...'`.
- The rehaul is **device-unverified** — typecheck and bundling pass, but it
  has never run on a phone. First job on a real device is the smoke test.
