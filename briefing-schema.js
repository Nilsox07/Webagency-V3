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

      umfang: [ // Single-Choice — Preis-Floors (ab-Preise) werden in briefing.js aus pricing.js ergänzt
        { value: 'onepager',    label: 'One-Pager', sub: 'alles auf einer Seite' },           // → Start (ab 1.290 €)
        { value: 'kompakt',     label: 'Mehrere Seiten', sub: 'bis 8' },                       // → Wachstum (ab 2.990 €)
        { value: 'umfangreich', label: 'Groß', sub: 'bis 20 Seiten' },                         // → Platzhirsch (ab 5.990 €)
        { value: 'gross',       label: 'Über 20 Seiten / Shop / Portal', sub: 'individuelles Festpreis-Angebot' }, // → Sonderprojekte
      ],

      seiten: [ // Multi-Select, bedingte Folgefrage (nur wenn nicht One-Pager)
        { value: 'start',      label: 'Startseite' },
        { value: 'ueber',      label: 'Über uns' },
        { value: 'leistungen', label: 'Leistungen / Angebote' },
        { value: 'preise',     label: 'Preise / Preisliste' },
        { value: 'projekte',   label: 'Galerie / Projekte' },
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

      features: [ // Multi-Select (zwei Schritte: Aktionen + Inhalte). Labels = Anzeige im Admin/Read-back.
        { value: 'kontaktformular', label: 'Kontaktformular' },
        { value: 'terminbuchung',   label: 'Online-Terminbuchung' },
        { value: 'ki-assistent',    label: 'KI-Chat-Assistent' },
        { value: 'shop',            label: 'Shop / Bezahlung' },
        { value: 'login',           label: 'Geschützter Kundenbereich' },
        { value: 'whatsapp',        label: 'WhatsApp-Kontakt' },
        { value: 'bewertungen',     label: 'Google-Bewertungen' },
        { value: 'blog',            label: 'Neuigkeiten / Blog' },
        { value: 'galerie',         label: 'Bildergalerie' },
        { value: 'newsletter',      label: 'Newsletter-Anmeldung' },
        { value: 'mehrsprachig',    label: 'Mehrsprachig' },
        { value: 'anfahrt',         label: 'Anfahrt & Karte' },
        { value: 'social',          label: 'Social-Media-Einbindung' },
        { value: 'download',        label: 'Download-Bereich' },
        { value: 'beraten',         label: 'Weiß nicht / beraten lassen' },
      ],

      stil: [ // Single-Select, visuelle Moodboard-Karten (reine CSS-Grafik, lizenzfrei)
        { value: 'minimal',   label: 'Minimalistisch & clean', flavor: 'mood-minimal' },
        { value: 'elegant',   label: 'Elegant & edel',         flavor: 'mood-elegant' },
        { value: 'verspielt', label: 'Verspielt & bunt',       flavor: 'mood-verspielt' },
        { value: 'bold',      label: 'Bold & modern',          flavor: 'mood-bold' },
        { value: 'warm',      label: 'Warm & natürlich',       flavor: 'mood-warm' },
        { value: 'corporate', label: 'Corporate & seriös',     flavor: 'mood-corporate' },
      ],

      // Farbauswahl im Design-Schritt: laienverständlich, Haupt- + Nebenfarbe
      // (jeweils Single-Select aus dieser Liste; KEIN HEX-Zwang)
      farben: [ // mood = Wirkungs-Label (zweite Zeile am Farbkreis)
        { value: 'blau',      label: 'Blau',        hex: '#2a5bd7', mood: 'vertrauensvoll' },
        { value: 'tuerkis',   label: 'Türkis',      hex: '#2bb3a3', mood: 'frisch' },
        { value: 'gruen',     label: 'Grün',        hex: '#2f7d4f', mood: 'natürlich' },
        { value: 'lime',      label: 'Lime',        hex: '#b6ff3b', mood: 'energiegeladen' },
        { value: 'gelb',      label: 'Gelb',        hex: '#f5c518', mood: 'freundlich' },
        { value: 'orange',    label: 'Orange',      hex: '#f2872f', mood: 'einladend' },
        { value: 'rot',       label: 'Rot',         hex: '#d94d2a', mood: 'kraftvoll' },
        { value: 'pink',      label: 'Pink',        hex: '#ff5a8a', mood: 'auffällig' },
        { value: 'violett',   label: 'Violett',     hex: '#7b5cff', mood: 'kreativ' },
        { value: 'gold',      label: 'Gold',        hex: '#c9a227', mood: 'hochwertig' },
        { value: 'anthrazit', label: 'Anthrazit',   hex: '#222a36', mood: 'markant' },
        { value: 'beige',     label: 'Beige',       hex: '#d8c4a0', mood: 'warm' },
        { value: 'weiss',     label: 'Weiß',        hex: '#f4f6f8', mood: 'pur' },
      ],

      material: [ // Multi-Select
        { value: 'logo',    label: 'Logo' },
        { value: 'ci',      label: 'Markenfarben / CI' },
        { value: 'texte',   label: 'Texte' },
        { value: 'fotos',   label: 'Eigene Fotos' },
        { value: 'videos',  label: 'Videos' },
        { value: 'profil',  label: 'Google-Unternehmensprofil' },
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
      stil:               { type: 'single', step: 5, required: false },
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
