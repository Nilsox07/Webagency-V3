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
  var SUPABASE_URL = 'https://uoinusdxnrvntqnafnsk.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvaW51c2R4bnJ2bnRxbmFmbnNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzUyMjIsImV4cCI6MjA5NjY1MTIyMn0.NCTWr8qsz5LOzkMKlq4uWw9cJk-4Q7VKjhBR_xVZrtY';

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
