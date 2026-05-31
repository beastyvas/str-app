-- Saved workout templates
CREATE TABLE IF NOT EXISTS public.workout_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  exercises jsonb NOT NULL DEFAULT '[]', -- [{id, name, muscle_group, equipment_type}]
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own templates"
  ON public.workout_templates FOR ALL USING (auth.uid() = user_id);

CREATE INDEX workout_templates_user_idx ON public.workout_templates(user_id);
