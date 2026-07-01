-- Onboarding sends every new user to add the creator (@beastyvas) as their
-- first friend, but a non-friend sees no PRs/rank — so the showcase profile
-- looks empty. Expose ONLY the owner account's PRs to any signed-in user, as
-- social proof. Everyone else's PRs stay gated behind accepted friendship
-- (the "Friends can view PRs" policy from migration 001). Permissive policies
-- are OR'd together, so this only widens access for is_owner rows.
CREATE POLICY "Anyone can view the creator's PRs"
  ON public.personal_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = personal_records.user_id
        AND u.is_owner = true
    )
  );
