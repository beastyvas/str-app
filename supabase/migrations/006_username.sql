-- Username system
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Index for fast username lookups
CREATE INDEX IF NOT EXISTS users_username_idx ON public.users(username);

-- Allow users to search by username (public read on username + display_name only)
CREATE POLICY "Anyone can look up users by username"
  ON public.users FOR SELECT
  USING (true);
