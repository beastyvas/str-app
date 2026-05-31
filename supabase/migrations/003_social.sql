-- STR Social layer

-- Add bio to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio text;

-- Create avatars storage bucket (run this separately in dashboard if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Allow friends to see each other's completed workouts (for social feed)
CREATE POLICY "Friends can view each other workouts"
  ON public.workouts FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND ended_at IS NOT NULL
        AND (
          (f.requester_id = auth.uid() AND f.addressee_id = user_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = user_id)
        )
    )
  );
