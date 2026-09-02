import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://am-naguib.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://am-naguib.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: cors(origin) });
  }

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return new Response(JSON.stringify({ error: "missing_session" }), { status: 401, headers: cors(origin) });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "invalid_session" }), { status: 401, headers: cors(origin) });
  }

  const { data: existing } = await admin
    .from("authorized_devices")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ ok: true, alreadyAuthorized: true }), { headers: cors(origin) });
  }

  const now = new Date();
  const windowMs = 15 * 60 * 1000;
  const { data: attemptRow } = await admin
    .from("site_password_attempts")
    .select("attempts,window_started_at")
    .eq("user_id", user.id)
    .maybeSingle();

  let attempts = attemptRow?.attempts ?? 0;
  let started = attemptRow?.window_started_at ? new Date(attemptRow.window_started_at) : now;
  if (now.getTime() - started.getTime() > windowMs) {
    attempts = 0;
    started = now;
  }

  if (attempts >= 5) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now.getTime() - started.getTime())) / 1000));
    return new Response(JSON.stringify({ error: "too_many_attempts", retryAfterSeconds }), { status: 429, headers: cors(origin) });
  }

  let body: { password?: string } = {};
  try { body = await req.json(); } catch {}

  const { data: valid, error: verifyError } = await admin.rpc("verify_site_password", {
    candidate: String(body.password || ""),
  });

  if (verifyError) {
    return new Response(JSON.stringify({ error: "verification_failed" }), { status: 500, headers: cors(origin) });
  }

  if (!valid) {
    attempts += 1;
    await admin.from("site_password_attempts").upsert({
      user_id: user.id,
      attempts,
      window_started_at: started.toISOString(),
    });
    return new Response(JSON.stringify({ error: "wrong_password", remaining: Math.max(0, 5 - attempts) }), { status: 403, headers: cors(origin) });
  }

  const { error: approveError } = await admin.from("authorized_devices").upsert({ user_id: user.id });
  if (approveError) {
    return new Response(JSON.stringify({ error: "approval_failed" }), { status: 500, headers: cors(origin) });
  }

  await admin.from("site_password_attempts").delete().eq("user_id", user.id);
  return new Response(JSON.stringify({ ok: true }), { headers: cors(origin) });
});
