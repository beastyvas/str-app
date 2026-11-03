-- ─────────────────────────────────────────────────────────────────────────────
-- 029_power_level.sql
-- Power Level: a bodyweight-relative strength number computed client-side
-- (src/lib/powerLevel.ts) and written on workout finish and onboarding
-- completion. Rank (tier + sub-tier) is stored alongside so friends' rows can
-- show a rank chip tinted with THEIR aura without recomputing from raw sets.
--
-- Own-row UPDATE on public.users is already allowed by migration 001's
-- "Users can update their own profile" policy, so no new policy is needed.
-- Per the 026→027 RLS lesson, nothing here subqueries public.users from a
-- policy — other users read these columns only through the public_profiles
-- view.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS power_level      integer,
  ADD COLUMN IF NOT EXISTS power_confidence text
    CHECK (power_confidence IS NULL OR power_confidence IN ('full', 'partial', 'calibrating')),
  ADD COLUMN IF NOT EXISTS rank_tier_key    text
    CHECK (rank_tier_key IS NULL OR rank_tier_key IN ('mortal', 'awakened', 'ascendant', 'phantom', 'sovereign', 'godhand')),
  ADD COLUMN IF NOT EXISTS rank_sub_tier    smallint
    CHECK (rank_sub_tier IS NULL OR rank_sub_tier BETWEEN 1 AND 4);

-- Recreate public_profiles keeping every column from 028, then the new ones.
-- (DROP + CREATE: CREATE OR REPLACE can't add columns mid-list.)
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
SELECT
  id,
  username,
  display_name,
  avatar_url,
  bio,
  bodyweight_lbs,
  unit_pref,
  is_pro,
  is_og,
  is_owner,
  split_type,
  split_schedule,
  profile_public,
  power_level,
  power_confidence,
  rank_tier_key,
  rank_sub_tier
FROM public.users;

GRANT SELECT ON public.public_profiles TO authenticated;
