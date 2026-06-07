-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening — closes two issues found in a pre-launch review:
--
-- 1. Any authenticated client could write directly to billing/usage columns
--    (e.g. `update users set is_pro = true where id = auth.uid()`), granting
--    themselves Pro or resetting their AI ask counter for free. RLS update
--    policies restrict which ROWS can be touched, not which COLUMNS — so a
--    trigger is needed to lock specific columns to server-only writes.
--
-- 2. Migration 006 added `USING (true)` to users SELECT, which (Postgres ORs
--    permissive policies together) let any authenticated user read every
--    column of every user — emails, training notes, ai_asks_count, RevenueCat
--    customer IDs, etc. Replaced with a narrow public-safe view for
--    search/suggestions/QR-add/friend-profile-card use cases.
-- ─────────────────────────────────────────────────────────────────────────────

-- Training split columns (previously applied ad-hoc — formalized here)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS split_type TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS split_schedule JSONB;


-- ── 1. Lock billing/usage columns to server-only writes ─────────────────────
CREATE OR REPLACE FUNCTION public.protect_subscription_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.is_pro IS DISTINCT FROM OLD.is_pro
       OR NEW.ai_asks_count IS DISTINCT FROM OLD.ai_asks_count
       OR NEW.ai_asks_week_start IS DISTINCT FROM OLD.ai_asks_week_start
       OR NEW.rc_customer_id IS DISTINCT FROM OLD.rc_customer_id
    THEN
      RAISE EXCEPTION 'Subscription and usage fields can only be modified by the server';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_subscription_columns_trigger ON public.users;
CREATE TRIGGER protect_subscription_columns_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_subscription_columns();


-- ── 2. Replace "anyone can read everything" with a narrow public view ───────
DROP POLICY IF EXISTS "Anyone can look up users by username" ON public.users;

-- Exposes only fields meant to be discoverable by any user — never email,
-- training_notes, ai_asks_*, rc_customer_id, gender, experience_level, etc.
-- Owned by the migration role (postgres), which bypasses RLS on public.users,
-- so this view returns all profiles while only ever projecting safe columns.
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  username,
  display_name,
  avatar_url,
  bio,
  bodyweight_lbs,
  is_pro,
  is_og,
  is_owner,
  split_type,
  split_schedule
FROM public.users;

GRANT SELECT ON public.public_profiles TO authenticated;
