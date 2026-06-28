-- "Get your weekly plan from Coach" (the Getting Started step) was tracked only
-- in local AsyncStorage, so it reset on logout/reinstall/new device and the task
-- reappeared. Back it with a durable server flag on the user row.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weekly_plan_done BOOLEAN NOT NULL DEFAULT false;
