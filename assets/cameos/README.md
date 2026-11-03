# Cameo art

The app ships **placeholders** (a colored circle with initials). You supply
the real character art; the scripts never draw, trace, or generate any.

## Specs
- **Transparent PNG**, about **600 × 800 px** (3:4), character from roughly chest up.
- Character **facing left** (they peek in from the right edge).
- Under **~300 KB** each (the pipeline compresses for you).
- Per character folder: `portrait.png` (**required**, neutral/confident) and
  `hype.png` (optional — powered up, shouting, aura; used for PRs, rank-ups,
  heavy days, over-9000; falls back to `portrait.png`).
- **39 characters → 39 required portraits + up to 39 optional hype images.**
  Start with your current world's six plus the guests (`broly`, `yujiro`,
  `roshi`); placeholders cover the rest. See `CAST_CHECKLIST.md` for the
  shopping list.

## Workflow
One-time: `npm --prefix scripts install` (sharp + offline background
removal; kept out of the app's package.json so EAS builds stay lean).

1. Drop raw images in `assets/cameos/_inbox/` named by character ID:
   `gojo.jpg`, `gojo-hype.png`, `allmight.webp` (any format sharp reads).
2. `node scripts/process-cameos.mjs` — removes the background (skipped if
   already transparent), trims, crops 600×800 with the face high, compresses,
   writes `<id>/portrait.png` / `hype.png`, moves raws to `_inbox/done/`, and
   resyncs the registry.
3. Open `assets/cameos/_preview.html` and eyeball crops and facing. Facing
   right? Set `"gojo": { "flip": true }` (or `"gojo-hype"`) in
   `manifest.json` and re-drop the raw file.
4. `eas update` — images are JS assets, no new binary needed.

Dropped a `hype.png` straight into a folder by hand? Run
`node scripts/sync-cameo-registry.mjs` so the app picks it up.

Other scripts: `make-cameo-placeholders.mjs` (recreates any missing
placeholder; never overwrites real art).
