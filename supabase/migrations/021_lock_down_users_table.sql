-- Migration 019 reopened a blanket "Authenticated users can read public profile
-- fields" policy with USING (true) directly on public.users. RLS policies gate
-- ROWS, not columns, so that policy actually let any authenticated user read
-- EVERY column for EVERY user — including email, training_notes, gender,
-- experience_level, ai_asks_count, ai_asks_week_start, and rc_customer_id.
--
-- The public_profiles view (created in 018/019) already exists specifically to
-- expose only the safe, intended-public columns. Revert public.users SELECT
-- access to strictly own-row, and route all "read another user's public info"
-- call sites through public_profiles instead.
drop policy if exists "Authenticated users can read public profile fields" on public.users;

-- "Users can view their own profile" (auth.uid() = id) from migration 001
-- already covers legitimate own-row reads, so no replacement policy is needed.
