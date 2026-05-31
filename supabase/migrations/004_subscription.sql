-- STR subscription tracking
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_pro boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ai_asks_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ai_asks_week_start timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS rc_customer_id text; -- RevenueCat customer ID
