-- grade-workout has no rate limit: it only skips the AI call when a workout's
-- ai_grade is already set, but a client can freely UPDATE its own workout rows
-- (the "Users can manage their own workouts" FOR ALL policy), so resetting
-- ai_grade back to NULL and re-invoking the function repeatedly would burn
-- unlimited Anthropic calls. Add a server-only daily counter, following the
-- same pattern as ai_asks_count/ai_asks_week_start in migration 018.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS grade_calls_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS grade_calls_day_start TIMESTAMPTZ;

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
       OR NEW.grade_calls_count IS DISTINCT FROM OLD.grade_calls_count
       OR NEW.grade_calls_day_start IS DISTINCT FROM OLD.grade_calls_day_start
    THEN
      RAISE EXCEPTION 'Subscription and usage fields can only be modified by the server';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
