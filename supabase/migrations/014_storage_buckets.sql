-- Create workout-photos bucket (public read, authenticated write to own folder)
INSERT INTO storage.buckets (id, name, public)
VALUES ('workout-photos', 'workout-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Workout photos: public read
CREATE POLICY "Workout photos are publicly viewable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'workout-photos');

-- Workout photos: authenticated users upload to their own folder
CREATE POLICY "Users can upload workout photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'workout-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Workout photos: users can update/delete their own
CREATE POLICY "Users can update own workout photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'workout-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own workout photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'workout-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Avatars bucket policies (if not already set)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatars are publicly viewable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
