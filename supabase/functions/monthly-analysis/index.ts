import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FREE_RUNS_PER_MONTH = 1;

// Server-owned coach identity — mirror of src/constants/ranks.ts. The client
// sends only a validated tier key, never prompt text (see ai-coach for the
// same pattern).
const TIER_COACH_NAME: Record<string, string> = {
  mortal: 'The Mentor',
  awakened: 'The Trainer',
  ascendant: 'The Tactician',
  phantom: 'The Rival',
  sovereign: 'The Sovereign',
  godhand: 'The Limitless',
};

const TIER_COACH_PERSONALITY: Record<string, string> = {
  mortal: "You're speaking to a lifter at the very start of their journey. Be warm, protective, and foundational — build their confidence, focus on habits and basics, never overwhelm them.",
  awakened: "This lifter has unlocked something real. Push them harder than they push themselves — direct, motivating, honest.",
  ascendant: "Technical territory. Speak to programming concepts — RPE, volume landmarks, weak-point training. They want the WHY.",
  phantom: "This athlete has surpassed most lifters. Cold analysis, no hand-holding, peer-level conversation.",
  sovereign: "S-rank mentality. Surgical feedback, precise programming. Waste no words.",
  godhand: "Elite. No basics, no encouragement needed, pure precision. Speak to a force of nature as an equal.",
};

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

// First instant of the current calendar month, in UTC.
function monthStartIso(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
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

    // ── Server-side monthly rate limiting (free: 1/calendar month, pro: ∞) ──
    const { data: userData } = await supabase
      .from('users')
      .select('is_pro, monthly_analysis_count, monthly_analysis_month_start, bodyweight_lbs, training_style, training_notes, experience_level, primary_goal')
      .eq('id', user.id)
      .single();

    const isPro = userData?.is_pro ?? false;
    const now = new Date();
    const curMonth = monthStartIso(now);
    const storedMonth = userData?.monthly_analysis_month_start
      ? monthStartIso(new Date(userData.monthly_analysis_month_start))
      : null;
    const isNewMonth = storedMonth !== curMonth;
    const currentCount = isNewMonth ? 0 : (userData?.monthly_analysis_count ?? 0);

    if (!isPro && currentCount >= FREE_RUNS_PER_MONTH) {
      return new Response(
        JSON.stringify({ error: 'limit', message: 'Free plan includes 1 Monthly Analysis per month. Upgrade to Pro for unlimited deep-dives.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    // New clients send { tierKey, subTier }; legacy builds sent free-text
    // coachName/tierPersonality, which we no longer trust — unknown/missing
    // keys fall back to the default identity.
    const tierKey: string = typeof body.tierKey === 'string' && body.tierKey in TIER_COACH_NAME
      ? body.tierKey
      : (typeof body.rankTierKey === 'string' && body.rankTierKey in TIER_COACH_NAME ? body.rankTierKey : 'mortal');
    const subTier: number = Number.isInteger(body.subTier) && body.subTier >= 0 && body.subTier <= 5 ? body.subTier : 0;
    const coachName = `${TIER_COACH_NAME[tierKey]}${ROMAN[subTier] ? ` ${ROMAN[subTier]}` : ''}`;
    const tierPersonality = TIER_COACH_PERSONALITY[tierKey];

    // ── Pull the last 30 days of training ───────────────────────────────────
    const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, name, started_at')
      .eq('user_id', user.id)
      .not('ended_at', 'is', null)
      .gte('started_at', thirtyAgo)
      .order('started_at', { ascending: true });

    const workoutIds = (workouts ?? []).map((w: any) => w.id);
    const { data: sets } = workoutIds.length > 0
      ? await supabase
          .from('workout_sets')
          .select('workout_id, weight, reps, rpe, note, logged_at, exercises(name, muscle_group)')
          .in('workout_id', workoutIds)
      : { data: [] as any[] };

    const allSets = (sets ?? []) as any[];
    if (allSets.length === 0) {
      return new Response(
        JSON.stringify({ error: 'no_data', message: 'Not enough training logged in the last 30 days to analyze yet. Log a few workouts and come back.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Volume + sets per muscle group
    const byGroup: Record<string, { sets: number; volume: number }> = {};
    // Per-exercise weekly progression (week index 0..4) of top e1RM, plus RPE
    const exWeekly: Record<string, Record<number, { topE1rm: number; rpes: number[] }>> = {};
    const notes: string[] = [];
    const nowMs = Date.now();

    for (const s of allSets) {
      const mg = s.exercises?.muscle_group ?? 'Other';
      const exName = s.exercises?.name ?? 'Unknown';
      const vol = (s.weight ?? 0) * (s.reps ?? 0);
      if (!byGroup[mg]) byGroup[mg] = { sets: 0, volume: 0 };
      byGroup[mg].sets += 1;
      byGroup[mg].volume += vol;

      const week = Math.min(4, Math.floor((nowMs - new Date(s.logged_at).getTime()) / (7 * 86400000)));
      if (!exWeekly[exName]) exWeekly[exName] = {};
      if (!exWeekly[exName][week]) exWeekly[exName][week] = { topE1rm: 0, rpes: [] };
      const e1rm = (s.weight ?? 0) * (1 + (s.reps ?? 0) / 30);
      exWeekly[exName][week].topE1rm = Math.max(exWeekly[exName][week].topE1rm, Math.round(e1rm));
      if (s.rpe) exWeekly[exName][week].rpes.push(s.rpe);

      if (s.note && s.note.trim()) notes.push(s.note.trim());
    }

    const groupLines = Object.entries(byGroup)
      .sort((a, b) => b[1].sets - a[1].sets)
      .map(([g, v]) => `  ${g}: ${v.sets} sets, ${Math.round(v.volume).toLocaleString()} lbs volume`)
      .join('\n');

    // week labels: 4 = oldest, 0 = this week
    const weekLabel = (w: number) => (w === 0 ? 'this wk' : `${w}wk ago`);
    const exLines = Object.entries(exWeekly)
      .map(([name, weeks]) => {
        const ordered = [4, 3, 2, 1, 0].filter(w => weeks[w]);
        const prog = ordered
          .map(w => {
            const rpes = weeks[w].rpes;
            const avgRpe = rpes.length ? ` @${(rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1)}` : '';
            return `${weekLabel(w)} ${weeks[w].topE1rm}e1rm${avgRpe}`;
          })
          .join(' → ');
        return `  ${name}: ${prog}`;
      })
      .join('\n');

    const totalSets = allSets.length;
    const totalVolume = Object.values(byGroup).reduce((s, v) => s + v.volume, 0);
    const sessionCount = (workouts ?? []).length;

    const noteBlock = notes.length > 0
      ? `\n\nPER-SET NOTES (verbatim, look for recurring themes like a body part repeatedly mentioned):\n${notes.map(n => `  - "${n}"`).join('\n')}`
      : '';

    const dataSummary = `TRAINING DATA — LAST 30 DAYS
Sessions: ${sessionCount} · Total sets: ${totalSets} · Total volume: ${Math.round(totalVolume).toLocaleString()} lbs
Athlete: ${userData?.bodyweight_lbs ?? '?'} lbs${userData?.experience_level ? `, ${userData.experience_level}` : ''}${userData?.primary_goal ? `, goal: ${userData.primary_goal}` : ''}${userData?.training_style ? `, style: ${userData.training_style}` : ''}

VOLUME BY MUSCLE GROUP (sets + tonnage):
${groupLines}

PER-EXERCISE PROGRESSION (top estimated 1RM by week, with avg RPE — oldest → newest):
${exLines}${noteBlock}${userData?.training_notes ? `\n\nATHLETE BACKGROUND (their words — read for injuries/context, not literally):\n${userData.training_notes}` : ''}`;

    const systemPrompt = `You are ${coachName}, a strength analyst writing a monthly training report for one athlete in the STR app. Tone: ${tierPersonality}

This is NOT a chat reply — it's a written report. Read THEIR actual numbers below and surface real trends:
- Volume distribution: which muscle groups are getting the most/least work; call out anything clearly neglected or overcooked.
- RPE creep: if the same or lighter e1RM is showing HIGHER RPE over the weeks, that's under-recovery — flag it.
- Stalled lifts: e1RM flat or dropping across weeks.
- Recurring note themes: if a body part or issue (e.g. "left shoulder") shows up repeatedly, name it.

Format: a short opening line, then 3-5 tight findings as a dash list, then one bolded bottom-line action. Be specific to their numbers — cite the muscle group, lift, or RPE you mean. No generic advice, no filler, no hedging. Under 220 words.`;

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
        system: systemPrompt,
        messages: [{ role: 'user', content: dataSummary }],
      }),
    });

    const aiData = await response.json();
    const report: string = aiData?.content?.[0]?.text?.trim() ?? '';
    if (!response.ok || !report) {
      throw new Error(aiData?.error?.message ?? 'Analysis generation failed');
    }

    // Record the run + persist the report (service role bypasses the
    // protect_subscription_columns trigger).
    const lastRun = new Date().toISOString();
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    await supabaseAdmin.from('users').update({
      monthly_analysis_count: isNewMonth ? 1 : currentCount + 1,
      monthly_analysis_month_start: curMonth,
      monthly_analysis_last_run: lastRun,
      monthly_analysis_last_report: report,
    }).eq('id', user.id);

    return new Response(JSON.stringify({ report, lastRun }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
