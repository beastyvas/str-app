-- AI workout grading — written by the grade-workout edge function after each session.
-- ai_grade: single emoji (💀 🔥 ✅ 😐 🤕)
-- ai_summary: one AI-written sentence (shown to Pro users; free users see a canned line)
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS ai_grade TEXT;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS ai_summary TEXT;
