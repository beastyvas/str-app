-- Monthly Analysis (premium AI deep-dive into training trends).
-- Free users get 1 run per calendar month; Pro users unlimited. Enforced
-- server-side in the monthly-analysis edge function via these columns, which
-- follow the same server-only-write lockdown as the existing ai_asks_* and
-- subscription columns (see migration 018 / 022).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS monthly_analysis_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS monthly_analysis_month_start TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS monthly_analysis_last_run TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS monthly_analysis_last_report TEXT;

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
       OR NEW.monthly_analysis_count IS DISTINCT FROM OLD.monthly_analysis_count
       OR NEW.monthly_analysis_month_start IS DISTINCT FROM OLD.monthly_analysis_month_start
       OR NEW.monthly_analysis_last_run IS DISTINCT FROM OLD.monthly_analysis_last_run
       OR NEW.monthly_analysis_last_report IS DISTINCT FROM OLD.monthly_analysis_last_report
    THEN
      RAISE EXCEPTION 'Subscription and usage fields can only be modified by the server';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
