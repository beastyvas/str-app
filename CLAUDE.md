# STR — working notes for Claude Code

Social strength-training app. Log lifts, get an AI coach, rank against strength
standards, share sessions with friends.

**Stack:** Expo SDK 54 · React Native 0.81 · Hermes · New Architecture ·
expo-router · TypeScript · Supabase (Postgres + RLS + Edge Functions) ·
RevenueCat (subscriptions) · Zustand (workout store).

---

## Branches & versions

| Branch | Version | Purpose |
|---|---|---|
| `main` | 1.0.6 build 14 | The App Store line. Hotfixes only. |
| `redesign/v2` | 1.1.0 build 1 | **Active development.** Premium redesign, 12 commits ahead of main (contains everything main has). |

Work on `redesign/v2`. Once 1.0.6 is approved, collapsing them is one command:
`git checkout main && git merge --ff-only redesign/v2`.

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

- Apple-reviewed flows beyond restyling: paywall (`PaywallModal`), EULA,
  onboarding, First Steps completion semantics, RevenueCat wiring.
- Supabase schema/RLS — always via a new numbered migration.
- **RLS lesson (migrations 026→027):** a policy must never subquery
  `public.users` directly. Own-row RLS applies *inside* policy subqueries, so
  the check silently matches nothing. Use a `SECURITY DEFINER` helper
  (`is_owner_account`, `is_public_profile`) instead.

---

## Open threads

- **`coach-nudge` is dead.** The mid-workout coach banner (`WorkoutCoach`) was
  deleted; nothing calls this edge function anymore. Safe to delete it and
  `supabase functions delete coach-nudge` whenever.
- **Supabase:** confirm migrations `026`–`028` have run; deploy the
  `monthly-analysis` edge function (`supabase functions
  deploy <name>`; both need the `ANTHROPIC_API_KEY` secret).
- **`is_owner` is unset** for the creator account. It gates the creator
  showcase, auto-accept-friend (migration 012), and the owner badge — all
  silently no-op until someone runs
  `UPDATE public.users SET is_owner = true, is_og = true WHERE email = '...'`.
- **App Store 3.1.2(c):** the Terms of Use (EULA) link must appear in the App
  Store *description* (the in-app paywall already has it). Apple's standard
  EULA URL is fine.
- **Redesign remainder (pure JS → OTA-able after 1.1.0 ships):** profile and
  insights visual restyle onto primitives, plus the `Modal` → `SheetModal`
  sweep for the finish / name / note / edit-set modals.
- The redesign is **device-unverified** — it passed typecheck and bundling but
  has never run on a phone. First job on a real device is the smoke test.
