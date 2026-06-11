/* ============================================================
   Sartu · Detail-Onboarding (STUFE 2) — NACH der Buchung
   ------------------------------------------------------------
   // Detail-Onboarding nach Buchung – später
   ------------------------------------------------------------
   Bewusst getrennt von Stufe 1 (Lumi-Erst-Briefing, siehe briefing.js).

   ZWECK von Stufe 2: Erst wenn ein Paket gebucht ist, werden die
   TIEFEN Details abgefragt, die zum tatsächlichen BAUEN nötig sind.
   Diese Fragen gehören NICHT in das kurze Erst-Briefing.

   Geplanter Umfang (Platzhalter — hier später ausbauen):
     • Exakte Markenfarben (HEX/RGB), Logo als Vektordatei (SVG/AI/EPS)
     • Finale Seitenstruktur & Navigation (Seite für Seite)
     • Inhalte/Texte je Seite, Bildmaterial in Druckqualität
     • Domain, Hosting-/Mail-Zugänge, Rechtstexte (Impressum/Datenschutz)
     • Integrationen (Buchungstool, Zahlungsanbieter, CRM, Analytics)
     • Freigabe-/Korrektur-Workflow, Ansprechpartner, Deadlines

   Technischer Hinweis:
     - Wird erst aktiviert, sobald der Kunde gebucht hat (Stufe-1-Briefing
       liegt dann bereits strukturiert vor und kann hier vorbefüllt werden).
     - Eigener Flow / eigene Seite (z. B. onboarding.html), nicht briefing.html.
   ============================================================ */
(function () {
  'use strict';

  // Zentrales Schema für Stufe 2 — später füllen.
  window.SARTU_ONBOARDING_STAGE2_SCHEMA = {
    version: 0,
    stage: 2,
    active: false, // erst nach Buchung aktivieren
    slots: {
      // TODO: Detail-Felder definieren (siehe Kommentar oben)
    },
  };

  // Platzhalter-Init — Stufe 2 ist noch nicht gebaut.
  function initStage2() {
    // Detail-Onboarding nach Buchung – später
  }

  // Aktuell bewusst kein Auto-Start.
  void initStage2;
})();
