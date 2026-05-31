-- Expanded onboarding fields
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS experience_level text; -- 'beginner' | 'intermediate' | 'advanced' | 'competitive'
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS primary_goal text;     -- 'muscle' | 'strength' | 'fat_loss' | 'compete' | 'general'
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS training_style text;   -- 'powerlifting' | 'bodybuilding' | 'hybrid' | 'calisthenics' | 'athletic'
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS days_per_week integer; -- 1-7
