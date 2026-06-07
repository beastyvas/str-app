-- Track warmup sets separately — excluded from volume totals and PR checks
ALTER TABLE public.workout_sets
ADD COLUMN IF NOT EXISTS is_warmup boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS workout_sets_warmup_idx
ON public.workout_sets(workout_id, is_warmup);
