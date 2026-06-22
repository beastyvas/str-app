import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SetPayload {
  weight: number;
  reps: number;
  rpe?: number;
  note?: string;
  exerciseName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // In-session AI nudges are a Pro perk — verify server-side, never trust
    // the client's `isPro` prop for whether to actually spend an AI call.
    const { data: userData } = await supabase
      .from('users')
      .select('is_pro')
      .eq('id', user.id)
      .single();

    if (!userData?.is_pro) {
      return new Response(JSON.stringify({ error: 'Pro required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { lastSet, history, trainingStyle, animeTierKey } = await req.json() as {
      lastSet: SetPayload;
      history: SetPayload[];
      trainingStyle?: string;
      animeTierKey?: string;
    };
    if (!lastSet?.exerciseName) {
      return new Response(JSON.stringify({ error: 'lastSet required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const persona = animeTierKey === 'god_tier' || animeTierKey === 'final_boss'
      ? 'You are a cold, elite-level S-rank strength coach. Surgical, no hand-holding.'
      : trainingStyle === 'powerlifting'
        ? 'You are a powerlifting coach. Focus on technique, bar path, and meet prep.'
        : trainingStyle === 'bodybuilding'
          ? 'You are a bodybuilding coach. Focus on mind-muscle connection, volume, and hypertrophy.'
          : 'You are a knowledgeable strength coach. Be direct and practical.';

    const context = (history ?? []).length > 0
      ? `Previous sets this exercise: ${history.map(s => `${s.weight}×${s.reps}${s.rpe ? ` @${s.rpe}` : ''}`).join(', ')}. `
      : '';

    const setDesc = `Just logged: ${lastSet.exerciseName} ${lastSet.weight}×${lastSet.reps}${lastSet.rpe ? ` RPE ${lastSet.rpe}` : ''}${lastSet.note ? ` (note: "${lastSet.note}")` : ''}.`;

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');

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
        system: `${persona} Give ONE short coaching cue (1-2 sentences max, no filler). Be specific to the set data.`,
        messages: [{ role: 'user', content: `${context}${setDesc} Quick coaching note?` }],
      }),
    });

    const aiData = await response.json();
    const text = aiData?.content?.[0]?.text?.trim() ?? null;

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
