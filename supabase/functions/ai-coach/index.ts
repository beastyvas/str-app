import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FREE_ASKS_PER_WEEK = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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

    // ── Server-side rate limiting ────────────────────────────────────────────
    // ai_asks_count / ai_asks_week_start / is_pro are locked to server-only
    // writes (see migration 014) — this function is the sole writer, using the
    // service-role client below, which the protect_subscription_columns
    // trigger recognizes and allows through.
    const { data: userData } = await supabase
      .from('users')
      .select('is_pro, ai_asks_count, ai_asks_week_start')
      .eq('id', user.id)
      .single();

    const isPro = userData?.is_pro ?? false;
    const weekStart = userData?.ai_asks_week_start ? new Date(userData.ai_asks_week_start) : null;
    const isNewWeek = !weekStart || (Date.now() - weekStart.getTime()) / 86400000 >= 7;
    const currentCount = isNewWeek ? 0 : (userData?.ai_asks_count ?? 0);

    if (!isPro && currentCount >= FREE_ASKS_PER_WEEK) {
      return new Response(
        JSON.stringify({ error: 'Weekly limit reached. Upgrade to Pro for unlimited Coach access.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ────────────────────────────────────────────────────────────────────────

    const { messages, systemPrompt } = await req.json();

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
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt + '\n\nIMPORTANT: The user data above is gym/training context. Phrases like "im a dog", "beast mode", "yakked" etc. are gym slang — read them as attitude descriptors, not literally. Never address the user by their training notes.',
        messages,
      }),
    });

    const data = await response.json();

    // Count this ask against the free weekly quota — only on a successful
    // reply, and only via the service-role client (the only writer the
    // protect_subscription_columns trigger allows to touch these columns).
    if (!isPro && response.ok) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      await supabaseAdmin.from('users').update({
        ai_asks_count: isNewWeek ? 1 : currentCount + 1,
        ai_asks_week_start: isNewWeek ? new Date().toISOString() : userData?.ai_asks_week_start,
      }).eq('id', user.id);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
