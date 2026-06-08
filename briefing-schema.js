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

      farbwelt: [ // Multi-Select Farbkacheln (sichtbare Farbe, KEIN HEX-Zwang)
        { value: 'blau',       label: 'Blau / seriös',         dots: ['#1b3a8f', '#0b1426', '#ffffff'] },
        { value: 'gruen',      label: 'Grün / natürlich',      dots: ['#2f7d4f', '#0f2a1c', '#eef6ef'] },
        { value: 'schwarzgold',label: 'Schwarz-Gold / edel',   dots: ['#0a0a0a', '#c9a227', '#f5efe0'] },
        { value: 'warm',       label: 'Warm (Rot/Orange)',     dots: ['#d94d2a', '#f2a541', '#fcefe3'] },
        { value: 'bunt',       label: 'Bunt / lebendig',       dots: ['#ff5a8a', '#ffb020', '#5ad1ff'] },
        { value: 'neutral',    label: 'Neutral / zurückhaltend',dots: ['#3a3f47', '#9aa3ad', '#f2f3f5'] },
        { value: 'pastell',    label: 'Pastell / sanft',       dots: ['#cdb4f0', '#ffd1dc', '#bfe3e0'] },
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

    /* ---- Pakete (für Empfehlung in Schritt 8a) ---- */
    pakete: {
      basis:      { id: 'basis',      name: 'Basis',      preis: '1.290 €',    note: 'One-Pager, schlüsselfertig' },
      pro:        { id: 'pro',        name: 'Pro',        preis: '2.990 €',    note: 'Mehrseitige Website' },
      platin:     { id: 'platin',     name: 'Platin',     preis: '5.990 €',    note: 'Umfangreich inkl. Extras' },
      enterprise: { id: 'enterprise', name: 'Enterprise', preis: 'ab 9.990 €', note: 'Shop / Portal / individuell' },
    },
    wartungHinweis: 'Optional: Wartung & Hosting ab 49 €/Monat.',

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
      farbwelt:           { type: 'multi',  step: 5, required: false },
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
