-- Global feed + per-profile privacy.
--
-- users.profile_public controls whether a lifter's completed workouts, sets,
-- and PRs are visible to ANY signed-in user (global feed) or only to accepted
-- friends (previous behavior). Defaults to true — STR is a social lifting
-- app — with a one-tap toggle in Profile. Enforced at the database, not the UI.
--
-- Lesson from 027: NEVER subquery public.users directly inside a policy
-- (own-row RLS applies inside policy subqueries) — use a SECURITY DEFINER
-- helper instead.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_public boolean NOT NULL DEFAULT true;

-- ── Helper ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_public_profile(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = uid AND profile_public = true);
$$;

REVOKE ALL ON FUNCTION public.is_public_profile(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_public_profile(uuid) TO authenticated;

-- ── Public visibility policies (permissive — OR'd with friend policies) ─────
DROP POLICY IF EXISTS "Public profiles: completed workouts visible" ON public.workouts;
CREATE POLICY "Public profiles: completed workouts visible"
  ON public.workouts FOR SELECT
  TO authenticated
  USING (ended_at IS NOT NULL AND public.is_public_profile(user_id));

DROP POLICY IF EXISTS "Public profiles: sets of completed workouts visible" ON public.workout_sets;
CREATE POLICY "Public profiles: sets of completed workouts visible"
  ON public.workout_sets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_sets.workout_id
        AND w.ended_at IS NOT NULL
        AND public.is_public_profile(w.user_id)
    )
  );

DROP POLICY IF EXISTS "Public profiles: PRs visible" ON public.personal_records;
CREATE POLICY "Public profiles: PRs visible"
  ON public.personal_records FOR SELECT
  TO authenticated
  USING (public.is_public_profile(user_id));

-- Comments on public workouts are readable by anyone signed in (writing
-- already requires user_id = auth.uid(); report/block moderation applies)
DROP POLICY IF EXISTS "Anyone can view comments on public workouts" ON public.workout_comments;
CREATE POLICY "Anyone can view comments on public workouts"
  ON public.workout_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_comments.workout_id
        AND public.is_public_profile(w.user_id)
    )
  );

-- Photos on public workouts
DROP POLICY IF EXISTS "Anyone can view photos on public workouts" ON public.workout_photos;
CREATE POLICY "Anyone can view photos on public workouts"
  ON public.workout_photos FOR SELECT
  TO authenticated
  USING (public.is_public_profile(user_id));

-- ── Expose the flag through public_profiles ─────────────────────────────────
-- (DROP + CREATE: the live view's column order comes from 019 and includes
-- unit_pref; CREATE OR REPLACE can't reorder columns)
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
  profile_public
FROM public.users;

GRANT SELECT ON public.public_profiles TO authenticated;
