import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_GRADES = ['💀', '🔥', '✅', '😐', '🤕'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { workoutId } = await req.json();
    if (!workoutId) return new Response(JSON.stringify({ error: 'workoutId required' }), { status: 400, headers: corsHeaders });

    // Fetch the workout — must belong to the authed user
    const { data: workout } = await supabase
      .from('workouts')
      .select('id, name, started_at, ended_at, notes, workout_sets(weight, reps, rpe, note, exercises(name, muscle_group))')
      .eq('id', workoutId)
      .eq('user_id', user.id)
      .single();

    if (!workout) return new Response(JSON.stringify({ error: 'Workout not found' }), { status: 404, headers: corsHeaders });

    const sets = (workout.workout_sets ?? []) as any[];
    const durationMins = workout.ended_at
      ? Math.round((new Date(workout.ended_at).getTime() - new Date(workout.started_at).getTime()) / 60000)
      : 0;
    const totalSets = sets.length;
    const exercises = [...new Set(sets.map((s: any) => s.exercises?.name).filter(Boolean))];
    const topSet = sets.reduce((best: any, s: any) => {
      const e1rm = s.weight * (1 + s.reps / 30);
      return e1rm > (best ? best.weight * (1 + best.reps / 30) : 0) ? s : best;
    }, null);

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const prompt = `Grade this workout session. Be honest — not every workout is great.

Workout: ${workout.name}
Duration: ${durationMins} min
Sets logged: ${totalSets}
Exercises: ${exercises.join(', ') || 'none recorded'}${topSet ? `\nTop set: ${topSet.exercises?.name} ${topSet.weight}lbs × ${topSet.reps} reps` : ''}${workout.notes ? `\nAthlete notes: ${workout.notes}` : ''}

Grade scale:
💀 = absolute destroyer, crushed every set, a session to remember
🔥 = great session, strong effort, hit your goals
✅ = solid work, consistent, got the job done
😐 = average, low energy or cut a bit short
🤕 = rough session, injury/illness/cut very short

Respond ONLY in this exact format (no other text):
GRADE: [single emoji from the list above]
SUMMARY: [one punchy sentence, max 12 words, past tense, no filler]`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const aiData = await response.json();
    const text: string = aiData?.content?.[0]?.text ?? '';

    const gradeMatch = text.match(/GRADE:\s*(\S+)/);
    const summaryMatch = text.match(/SUMMARY:\s*(.+)/);

    const grade = gradeMatch?.[1] ?? '✅';
    const summary = summaryMatch?.[1]?.trim() ?? '';
    const safeGrade = VALID_GRADES.includes(grade) ? grade : '✅';

    // Write via service-role so it bypasses any future RLS on workouts
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    await supabaseAdmin
      .from('workouts')
      .update({ ai_grade: safeGrade, ai_summary: summary })
      .eq('id', workoutId);

    return new Response(JSON.stringify({ grade: safeGrade, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
