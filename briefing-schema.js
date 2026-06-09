/* ============================================================
   Sartu · Lumi — Zentrales Briefing-Schema (STUFE 1: Erst-Briefing)
   ------------------------------------------------------------
   Single Source of Truth für den gesamten Flow:
   - Jeder "Slot" = ein Feld, das Lumi abfragt.
   - Optionslisten werden NUR hier gepflegt; briefing.js liest sie aus.
   - Dient später auch als Eingabe für den (optionalen) LLM-Call und
     für die strukturierte Speicherung (Supabase / E-Mail).

   WICHTIG: Das ist bewusst NUR das kurze Erst-Briefing. Tiefe Fragen
   (exakte HEX-Farben, finale Seitenstruktur, Texte, Logo als Vektor)
   gehören in Stufe 2 (Detail-Onboarding nach Buchung) → onboarding-stage2.js
   ============================================================ */
(function () {
  'use strict';

  window.SARTU_BRIEFING_SCHEMA = {
    version: 1,
    stage: 1, // 1 = Erst-Briefing (dieses Lumi). 2 = Detail-Onboarding (später)
    totalSteps: 8, // sichtbare Schrittzahl für die Fortschrittsanzeige

    /* ---- Auswahllisten (zentral gepflegt) ---- */
    options: {
      branche: [
        { value: 'gastro',         label: 'Gastronomie / Café',     icon: '🍽️' },
        { value: 'handwerk',       label: 'Handwerk / Bau',          icon: '🔨' },
        { value: 'beratung',       label: 'Beratung / Coaching',     icon: '💡' },
        { value: 'gesundheit',     label: 'Gesundheit / Praxis',     icon: '🩺' },
        { value: 'kreativ',        label: 'Kreativ / Fotografie',    icon: '📷' },
        { value: 'shop',           label: 'Onlineshop / Handel',     icon: '🛍️' },
        { value: 'dienstleistung', label: 'Dienstleistung lokal',    icon: '🧰' },
        { value: 'immobilien',     label: 'Immobilien',              icon: '🏠' },
        { value: 'sonstiges',      label: 'Sonstiges',               icon: '✨' },
      ],

      ziele: [ // Multi-Select
        { value: 'neukunden', label: 'Neukunden / Anfragen gewinnen' },
        { value: 'termine',   label: 'Termine / Buchungen' },
        { value: 'verkaufen', label: 'Produkte verkaufen' },
        { value: 'info',      label: 'Über mich/uns informieren' },
        { value: 'vertrauen', label: 'Vertrauen / Image aufbauen' },
        { value: 'bewerber',  label: 'Bewerber finden' },
      ],

      umfang: [ // Single-Choice
        { value: 'onepager',    label: 'One-Pager',       sub: 'Alles auf einer Seite' },
        { value: 'kompakt',     label: 'Kompakt',         sub: '3–5 Seiten' },
        { value: 'umfangreich', label: 'Umfangreich',     sub: '6–12 Seiten' },
        { value: 'gross',       label: 'Großes Projekt',  sub: '12+ Seiten / Shop / Portal' },
      ],

      seiten: [ // Multi-Select, bedingte Folgefrage (nur wenn nicht One-Pager)
        { value: 'start',      label: 'Startseite' },
        { value: 'ueber',      label: 'Über uns' },
        { value: 'leistungen', label: 'Leistungen / Angebote' },
        { value: 'referenzen', label: 'Referenzen / Portfolio' },
        { value: 'team',       label: 'Team' },
        { value: 'kontakt',    label: 'Kontakt' },
        { value: 'blog',       label: 'Blog / News' },
        { value: 'faq',        label: 'FAQ' },
        { value: 'shop',       label: 'Shop' },
        { value: 'buchung',    label: 'Buchung / Termine' },
        { value: 'karriere',   label: 'Karriere / Jobs' },
        { value: 'unsure',     label: 'Weiß ich noch nicht' },
      ],

      features: [ // Multi-Select
        { value: 'kontaktformular', label: 'Kontaktformular' },
        { value: 'terminbuchung',   label: 'Online-Terminbuchung' },
        { value: 'shop',            label: 'Shop / Bezahlung' },
        { value: 'blog',            label: 'Blog / News' },
        { value: 'galerie',         label: 'Bildergalerie' },
        { value: 'mehrsprachig',    label: 'Mehrsprachig' },
        { value: 'newsletter',      label: 'Newsletter' },
        { value: 'social',          label: 'Social-Media-Einbindung' },
        { value: 'login',           label: 'Kundenbereich / Login' },
        { value: 'beraten',         label: 'Weiß nicht / beraten lassen' },
      ],

      stil: [ // Multi-Select, visuelle Moodboard-Karten (reine CSS-Grafik, lizenzfrei)
        { value: 'minimal',   label: 'Minimalistisch & clean', flavor: 'mood-minimal' },
        { value: 'elegant',   label: 'Elegant & edel',         flavor: 'mood-elegant' },
        { value: 'verspielt', label: 'Verspielt & bunt',       flavor: 'mood-verspielt' },
        { value: 'bold',      label: 'Bold & modern',          flavor: 'mood-bold' },
        { value: 'warm',      label: 'Warm & natürlich',       flavor: 'mood-warm' },
        { value: 'corporate', label: 'Corporate & seriös',     flavor: 'mood-corporate' },
      ],

      // Farbauswahl im Design-Schritt: laienverständlich, Haupt- + Nebenfarbe
      // (jeweils Single-Select aus dieser Liste; KEIN HEX-Zwang)
      farben: [
        { value: 'blau',      label: 'Blau',        hex: '#2a5bd7' },
        { value: 'hellblau',  label: 'Hellblau',    hex: '#4ea3ff' },
        { value: 'tuerkis',   label: 'Türkis',      hex: '#2bb3a3' },
        { value: 'gruen',     label: 'Grün',        hex: '#2f7d4f' },
        { value: 'lime',      label: 'Lime',        hex: '#b6ff3b' },
        { value: 'gelb',      label: 'Gelb',        hex: '#f5c518' },
        { value: 'orange',    label: 'Orange',      hex: '#f2872f' },
        { value: 'rot',       label: 'Rot',         hex: '#d94d2a' },
        { value: 'pink',      label: 'Pink',        hex: '#ff5a8a' },
        { value: 'violett',   label: 'Violett',     hex: '#7b5cff' },
        { value: 'gold',      label: 'Gold',        hex: '#c9a227' },
        { value: 'navy',      label: 'Dunkelblau',  hex: '#07111f' },
        { value: 'schwarz',   label: 'Schwarz',     hex: '#111317' },
        { value: 'anthrazit', label: 'Anthrazit',   hex: '#3a3f47' },
        { value: 'beige',     label: 'Beige',       hex: '#d8c4a0' },
        { value: 'weiss',     label: 'Weiß',        hex: '#f4f6f8' },
      ],

      material: [ // Multi-Select
        { value: 'logo',    label: 'Logo' },
        { value: 'ci',      label: 'Markenfarben / CI' },
        { value: 'texte',   label: 'Texte' },
        { value: 'fotos',   label: 'Eigene Fotos' },
        { value: 'website', label: 'Bestehende Website' },
        { value: 'nichts',  label: 'Noch nichts – bitte mitgestalten' },
      ],

      zeitrahmen: [ // Single-Choice
        { value: 'asap',  label: 'So schnell wie möglich' },
        { value: '4-6w',  label: 'In 4–6 Wochen' },
        { value: '2-3m',  label: 'In 2–3 Monaten' },
        { value: 'offen', label: 'Kein fester Termin' },
      ],
    },

    /* ---- Hinweis: Preise, Pakete und Wartung werden NICHT hier gepflegt,
       sondern zentral in pricing.js (Single Source of Truth für Konfigurator
       UND Live-Berechnung). Dieses Schema enthält nur die Briefing-Fragen. ---- */

    /* ---- Slot-Definition: so wird die gesammelte Antwort gespeichert ----
       Jeder Slot landet 1:1 im finalen Briefing-Objekt (siehe collect()).  */
    slots: {
      branche:            { type: 'single', step: 1, required: true },
      branche_sonstiges:  { type: 'text',   step: 1, required: false }, // nur bei "sonstiges"
      ziele:              { type: 'multi',  step: 2, required: false },
      umfang:             { type: 'single', step: 3, required: false },
      seiten:             { type: 'multi',  step: 3, required: false }, // bedingt
      features:           { type: 'multi',  step: 4, required: false },
      stil:               { type: 'multi',  step: 5, required: false },
      hauptfarbe:         { type: 'single', step: 5, required: false },
      nebenfarbe:         { type: 'single', step: 5, required: false },
      markenfarben_hex:   { type: 'text',   step: 5, required: false }, // optional, kein Zwang
      material:           { type: 'multi',  step: 6, required: false },
      uploads:            { type: 'files',  step: 6, required: false }, // {logo, fotos, texte, texte_notiz, website_link}
      zeitrahmen:         { type: 'single', step: 7, required: false },
      paket_empfohlen:    { type: 'derived',step: 8, required: false },
      paket_gewaehlt:     { type: 'single', step: 8, required: false },
      kontakt:            { type: 'group',  step: 8, required: true },  // {name, email, telefon, dsgvo}
    },
  };
})();
