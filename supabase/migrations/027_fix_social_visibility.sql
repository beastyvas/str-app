-- Two social-visibility fixes found while testing the first-friend flow:
--
-- 1. workout_sets NEVER had a friend-view SELECT policy. Friends could see a
--    workout's row (003) but its nested sets came back empty, so every
--    cross-user surface (friend profile, social feed) computed 0 volume /
--    no top lifts. Owners saw their own sets, which is why this hid so long.
--
-- 2. Migration 026's "Anyone can view the creator's PRs" subqueried
--    public.users — but 021 locked users SELECT to own-row, and RLS applies
--    inside policy subqueries, so the EXISTS silently never matched for
--    anyone but the creator. Fixed via a SECURITY DEFINER helper.

-- ── Helper: is this user id the showcase/owner account? ─────────────────────
-- SECURITY DEFINER so the check bypasses the own-row lock on public.users.
CREATE OR REPLACE FUNCTION public.is_owner_account(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = uid AND is_owner = true);
$$;

REVOKE ALL ON FUNCTION public.is_owner_account(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_owner_account(uuid) TO authenticated;

-- ── 1. Friends (and everyone, for the creator) can read sets of completed
--       workouts ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Friends can view sets in completed workouts" ON public.workout_sets;
CREATE POLICY "Friends can view sets in completed workouts"
  ON public.workout_sets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_sets.workout_id
        AND w.ended_at IS NOT NULL
        AND (
          w.user_id = auth.uid()
          OR public.is_owner_account(w.user_id)
          OR EXISTS (
            SELECT 1 FROM public.friendships f
            WHERE f.status = 'accepted'
              AND (
                (f.requester_id = auth.uid() AND f.addressee_id = w.user_id)
                OR (f.addressee_id = auth.uid() AND f.requester_id = w.user_id)
              )
          )
        )
    )
  );

-- ── 2. Repair the creator-showcase policies to use the definer helper ───────
DROP POLICY IF EXISTS "Anyone can view the creator's PRs" ON public.personal_records;
CREATE POLICY "Anyone can view the creator's PRs"
  ON public.personal_records FOR SELECT
  TO authenticated
  USING (public.is_owner_account(user_id));

-- The creator's completed workouts are also public showcase (new users land
-- on the creator profile before the auto-accept friendship row exists client-side)
DROP POLICY IF EXISTS "Anyone can view the creator's workouts" ON public.workouts;
CREATE POLICY "Anyone can view the creator's workouts"
  ON public.workouts FOR SELECT
  TO authenticated
  USING (ended_at IS NOT NULL AND public.is_owner_account(user_id));
