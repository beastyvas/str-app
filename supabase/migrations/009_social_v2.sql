-- Social v2: likes, comments, workout photos

-- Workout photos (attached to a workout)
CREATE TABLE IF NOT EXISTS public.workout_photos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workout_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Friends can view workout photos"
  ON public.workout_photos FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.addressee_id = user_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = user_id))
    )
  );
CREATE POLICY "Users manage their own photos"
  ON public.workout_photos FOR ALL USING (auth.uid() = user_id);

-- Workout likes
CREATE TABLE IF NOT EXISTS public.workout_likes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workout_id, user_id)
);
ALTER TABLE public.workout_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view likes" ON public.workout_likes FOR SELECT USING (true);
CREATE POLICY "Users manage their own likes" ON public.workout_likes FOR ALL USING (auth.uid() = user_id);

-- Workout comments
CREATE TABLE IF NOT EXISTS public.workout_comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workout_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Friends can view comments"
  ON public.workout_comments FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.addressee_id = user_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = user_id))
    )
  );
CREATE POLICY "Users manage their own comments"
  ON public.workout_comments FOR ALL USING (auth.uid() = user_id);
