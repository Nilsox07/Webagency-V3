/* ============================================================
   Sartu · Floating-Button (FAB) → Lumi / Konfigurator
   ------------------------------------------------------------
   Dezenter, immer erreichbarer CTA unten rechts auf allen Seiten
   AUSSER der Briefing-Seite selbst (dort läuft Lumi bereits).

   • Verlinkt auf briefing.html (Einstieg in Lumi/Konfigurator).
   • Kollidiert nicht mit dem Cookie-Banner: per CSS hebt er sich
     automatisch darüber, solange das Banner sichtbar ist (:has()).
   • Barrierefrei (aria-label), respektiert prefers-reduced-motion.

   ENTFERNEN: <script src="fab.js"> aus den Seiten nehmen
   (bzw. zentral per Skript) — sonst keine Abhängigkeiten.
   ============================================================ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Auf der Briefing-Seite NICHT anzeigen (Lumi ist dort schon der Inhalt)
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (page === 'briefing.html') return;

  function build() {
    if (document.querySelector('.fab')) return;
    var a = document.createElement('a');
    a.className = 'fab';
    a.href = 'briefing.html';
    a.setAttribute('aria-label', 'Briefing & Preisübersicht mit Lumi starten – in rund 2 Minuten');
    a.innerHTML =
      '<span class="fab-ico" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"/>' +
          '<path d="M12 8v.01M9.5 11h5M9.5 14h3"/>' +
        '</svg>' +
      '</span>' +
      '<span class="fab-label">In 2 Min. zum Angebot</span>';
    document.body.appendChild(a);

    // Sanftes Einblenden (per Klasse) — bei reduced motion ohne Bewegung
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { a.classList.add('is-in'); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
