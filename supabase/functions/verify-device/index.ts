import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://am-naguib.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
]);

function cors(origin: string | null) {
  const allow = origin && allowedOrigins.has(origin) ? origin : 'https://am-naguib.github.io';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: cors(origin) });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const shopPin = Deno.env.get('SHOP_PIN');

  if (!shopPin || !/^\d{6}$/.test(shopPin)) {
    return new Response(JSON.stringify({ error: 'server_not_configured' }), { status: 500, headers: cors(origin) });
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'missing_session' }), { status: 401, headers: cors(origin) });
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'invalid_session' }), { status: 401, headers: cors(origin) });
  }

  const { data: existing } = await admin
    .from('authorized_devices')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ ok: true, alreadyAuthorized: true }), { headers: cors(origin) });
  }

  const now = new Date();
  const { data: attemptRow } = await admin
    .from('device_pin_attempts')
    .select('attempts, window_started_at')
    .eq('user_id', user.id)
    .maybeSingle();

  let attempts = attemptRow?.attempts ?? 0;
  let windowStarted = attemptRow?.window_started_at ? new Date(attemptRow.window_started_at) : now;
  const windowMs = 15 * 60 * 1000;

  if (now.getTime() - windowStarted.getTime() > windowMs) {
    attempts = 0;
    windowStarted = now;
  }

  if (attempts >= 5) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now.getTime() - windowStarted.getTime())) / 1000));
    return new Response(JSON.stringify({ error: 'too_many_attempts', retryAfterSeconds }), { status: 429, headers: cors(origin) });
  }

  let body: { pin?: string } = {};
  try { body = await req.json(); } catch {}

  if (String(body.pin || '') !== shopPin) {
    attempts += 1;
    await admin.from('device_pin_attempts').upsert({
      user_id: user.id,
      attempts,
      window_started_at: windowStarted.toISOString(),
    });
    return new Response(JSON.stringify({ error: 'wrong_pin', remaining: Math.max(0, 5 - attempts) }), { status: 403, headers: cors(origin) });
  }

  const { error: approveError } = await admin.from('authorized_devices').insert({ user_id: user.id });
  if (approveError) {
    return new Response(JSON.stringify({ error: 'approval_failed' }), { status: 500, headers: cors(origin) });
  }

  await admin.from('device_pin_attempts').delete().eq('user_id', user.id);

  return new Response(JSON.stringify({ ok: true }), { headers: cors(origin) });
});
