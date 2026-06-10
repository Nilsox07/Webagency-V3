/* ============================================================
   Sartu · Kundenportal — Supabase-Client (Stufe 1)
   ------------------------------------------------------------
   NUR der anon key wird hier verwendet. Der service_role key
   gehört NIEMALS ins Frontend (nur in die Edge Function).
   Trage unten deine zwei Werte ein (Supabase → Project Settings → API).
   Lädt nach <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">.
   ============================================================ */
(function () {
  'use strict';
  var SUPABASE_URL = '[SUPABASE_URL]';
  var SUPABASE_ANON_KEY = '[SUPABASE_ANON_KEY]';

  var isPlaceholder = function (v) { return !v || /^\[.*\]$/.test(v); };
  window.SARTU_PORTAL_CONFIGURED = !isPlaceholder(SUPABASE_URL) && !isPlaceholder(SUPABASE_ANON_KEY);

  if (!window.supabase || !window.supabase.createClient) {
    console.error('[Portal] supabase-js nicht geladen (CDN-Script fehlt?).');
    window.sb = null;
    return;
  }
  if (!window.SARTU_PORTAL_CONFIGURED) {
    console.warn('[Portal] SUPABASE_URL / SUPABASE_ANON_KEY noch nicht gesetzt (Platzhalter).');
    window.sb = null;
    return;
  }
  // persistSession (Standard) lässt den Kunden auf seinem Gerät eingeloggt.
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
})();
