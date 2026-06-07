import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // ── Server-side entitlement check via RevenueCat ─────────────────────────
    // Purchases.logIn(userId) (see useAuth.tsx) sets the RevenueCat app_user_id
    // to the Supabase user ID, so we can look up the subscriber directly.
    const rcSecretKey = Deno.env.get('REVENUECAT_SECRET_KEY');
    if (!rcSecretKey) throw new Error('REVENUECAT_SECRET_KEY not configured');

    const rcRes = await fetch(`https://api.revenuecat.com/v1/subscribers/${user.id}`, {
      headers: { Authorization: `Bearer ${rcSecretKey}` },
    });
    if (!rcRes.ok) throw new Error(`RevenueCat lookup failed: ${rcRes.status}`);

    const rcData = await rcRes.json();
    const entitlements = rcData?.subscriber?.entitlements ?? {};
    const proEntitlement = entitlements['pro'] ?? entitlements['Pro'];
    const isActive = !!proEntitlement
      && (!proEntitlement.expires_date || new Date(proEntitlement.expires_date).getTime() > Date.now());

    // Only the service-role client can write is_pro / rc_customer_id
    // (protect_subscription_columns trigger — see migration 014).
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    await supabaseAdmin.from('users').update({
      is_pro: isActive,
      rc_customer_id: rcData?.subscriber?.original_app_user_id ?? user.id,
    }).eq('id', user.id);

    return new Response(JSON.stringify({ isPro: isActive }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
