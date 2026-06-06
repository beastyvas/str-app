-- Add day_of_week to workout_templates so templates can be pinned to a specific day
-- 0=Sunday, 1=Monday, 2=Tuesday, ... 6=Saturday, NULL=any day
ALTER TABLE public.workout_templates
ADD COLUMN IF NOT EXISTS day_of_week integer CHECK (day_of_week >= 0 AND day_of_week <= 6);

-- Index for fast lookup by user + day
CREATE INDEX IF NOT EXISTS workout_templates_day_idx
ON public.workout_templates(user_id, day_of_week)
WHERE day_of_week IS NOT NULL;
