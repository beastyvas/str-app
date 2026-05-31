-- Creator + OG badge system
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_og boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_number integer; -- signup order

-- Auto-assign user_number on insert (tracks signup order for OG badge)
CREATE SEQUENCE IF NOT EXISTS public.user_number_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_user_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.user_number := nextval('public.user_number_seq');
  -- First 100 users get OG badge automatically
  IF NEW.user_number <= 100 THEN
    NEW.is_og := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_user_number_trigger
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_user_number();

-- Mark the creator
-- UPDATE public.users SET is_owner = true, is_og = true WHERE email = 'vasquezjrnick@gmail.com';
