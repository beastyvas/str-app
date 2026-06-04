-- Allow users to delete their own account
-- Deletes public.users row (cascades to workouts, sets, PRs, friendships)
-- Then deletes the auth.users entry
CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete public profile (cascades to all related data via FK constraints)
  DELETE FROM public.users WHERE id = auth.uid();
  -- Delete the auth user
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Only the authenticated user can call this on themselves
REVOKE ALL ON FUNCTION public.delete_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;
