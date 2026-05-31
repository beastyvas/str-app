ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other'));
