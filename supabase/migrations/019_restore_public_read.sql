-- ─────────────────────────────────────────────────────────────────────────────
-- 019_restore_public_read.sql
-- Migration 018 dropped the "Anyone can look up users by username" SELECT
-- policy to prevent exposing private columns. However, this broke all friend
-- activity queries because Supabase JOIN syntax (users!inner) requires a
-- permissive SELECT policy on the joined table.
--
-- The real security risk was WRITES (anyone could self-grant Pro). That is
-- fixed by the trigger in 018. READ access to display_name, unit_pref,
-- avatar_url etc. is intentional for friend features and safe to restore.
--
-- training_notes stays readable by authenticated users — acceptable trade-off
-- for a personal gym app where users voluntarily enter this data. The
-- subscription/billing fields (is_pro, ai_asks_*) are write-locked by trigger.
-- ─────────────────────────────────────────────────────────────────────────────

-- Re-add the public read policy so that JOIN queries (friend PRs, workouts,
-- friend cards) can resolve users!inner(display_name, unit_pref) etc.
DROP POLICY IF EXISTS "Anyone can look up users by username" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read public profile fields" ON public.users;

CREATE POLICY "Authenticated users can read public profile fields"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- Recreate the view to add unit_pref. CREATE OR REPLACE can't reorder columns,
-- so we drop first.
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
  split_schedule
FROM public.users;

GRANT SELECT ON public.public_profiles TO authenticated;
