-- Mark imported workouts so they don't flood the feed
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS is_imported boolean NOT NULL DEFAULT false;
