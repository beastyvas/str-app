-- App Store Guideline 1.2 — user-generated-content moderation.
-- Adds: content reporting, user blocking, and an EULA-acceptance timestamp.

-- ── EULA acceptance ─────────────────────────────────────────────────────────
-- Recorded after the user agrees to the Terms of Use before account creation.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS eula_accepted_at TIMESTAMPTZ;

-- ── Content reports ─────────────────────────────────────────────────────────
-- Any user can flag objectionable content (a post, profile, comment, etc.) or
-- an abusive user. Reports are write-only for users and reviewed by the
-- developer out-of-band.
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  content_type text NOT NULL,          -- 'workout' | 'profile' | 'comment' | 'user'
  content_id text,                     -- id of the offending content (nullable for whole-user reports)
  reason text,                         -- optional free-text reason
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Users can file reports as themselves and read back their own reports.
CREATE POLICY "Users can file reports"
  ON public.content_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
  ON public.content_reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE INDEX IF NOT EXISTS content_reports_reported_idx
  ON public.content_reports(reported_user_id);

-- ── Blocked users ───────────────────────────────────────────────────────────
-- A block hides the blocked user's content from the blocker and is recorded
-- server-side so the developer is notified of abusive accounts.
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Users fully manage their own block list.
CREATE POLICY "Users manage their own blocks"
  ON public.blocked_users FOR ALL
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

CREATE INDEX IF NOT EXISTS blocked_users_blocker_idx
  ON public.blocked_users(blocker_id);
