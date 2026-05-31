-- Auto-accept friend requests sent to the app creator (is_owner = true)
-- This means new users instantly become "friends" with the creator
-- so they see the creator's workouts in their feed immediately

CREATE OR REPLACE FUNCTION public.auto_accept_owner_requests()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = NEW.addressee_id AND is_owner = true
  ) THEN
    NEW.status := 'accepted';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_accept_owner_requests_trigger
  BEFORE INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.auto_accept_owner_requests();
