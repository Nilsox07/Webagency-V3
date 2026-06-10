// ============================================================
// Sartu · Edge Function `invite_customer`
// ------------------------------------------------------------
// Lädt einen Kunden per E-Mail in Supabase Auth ein (inviteUserByEmail).
// Der service_role key wird AUSSCHLIESSLICH hier serverseitig aus den
// Function-Secrets gelesen — niemals im Frontend.
//
// Ablauf:
//   1. Caller-JWT aus dem Authorization-Header lesen.
//   2. Mit anon key + Caller-JWT prüfen: is_admin() === true. Sonst 403.
//   3. Mit service_role key inviteUserByEmail(email) ausführen.
//
// Deploy:  supabase functions deploy invite_customer
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//          (SUPABASE_* sind in Edge Functions standardmäßig gesetzt;
//           SUPABASE_SERVICE_ROLE_KEY ggf. via `supabase secrets set`.)
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'missing token' }, 401);

  // 1+2) Caller-Identität + Admin-Check (RLS-/security-definer-gestützt)
  const asCaller = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await asCaller.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'not authenticated' }, 401);

  const { data: isAdmin, error: adminErr } = await asCaller.rpc('is_admin');
  if (adminErr) return json({ error: 'admin check failed', detail: adminErr.message }, 500);
  if (isAdmin !== true) return json({ error: 'forbidden — admin only' }, 403);

  // Eingabe
  let payload: { email?: string; name?: string; redirectTo?: string };
  try { payload = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const email = (payload.email ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'invalid email' }, 400);

  // 3) Einladung mit service_role (nur hier!)
  const asAdmin = createClient(SUPABASE_URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await asAdmin.auth.admin.inviteUserByEmail(email, {
    data: { name: payload.name ?? null },
    redirectTo: payload.redirectTo ?? undefined,
  });
  if (error) {
    // Bereits existierender Nutzer ist kein harter Fehler für den Admin-Flow
    return json({ ok: false, error: error.message }, 200);
  }
  return json({ ok: true, user_id: data?.user?.id ?? null });
});
