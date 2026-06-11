/* ============================================================
   Sartu · ZENTRALE PREISDATEN  (entspricht später /lib/pricing)
   ------------------------------------------------------------
   >>> EINZIGE Pflegestelle. Werte 1:1 aus der Leistungsbeschreibung
       (Sartu — Leistungsbeschreibung, Version 2.0, Stand Juni 2026). <<<
   Speist Konfigurator-Karten UND Live-Berechnung.

   Pakete:   Basis 1.290 € (1 Seite), Pro 2.990 € (8), Platin 5.990 € (20),
             Enterprise ab 9.990 € (individuell)
   Care:     Care S 49, Care M 99, Care L 249 €/Mon (bei Jahreszahlung) — PFLICHT
   Extraseite: 199 € pro Seite
   Add-ons / Funktionen: siehe unten (aus der Leistungsbeschreibung)
   ============================================================ */
(function (root, factory) {
  var api = factory();
  root.SARTU_PRICING = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  return {
    currency: '€',
    taxNote: 'Alle Preise netto zzgl. gesetzl. MwSt. · Stand Juni 2026',

    /* ---- Extraseite (Variante A): Inklusiv-Kontingent + Festpreis je weiterer Seite ---- */
    extraPage: { price: 199, label: 'Zusätzliche Seite' }, // Leistungsbeschreibung: 199 €/Seite

    /* ---- Pakete (einmalig) ----
       WICHTIG: id bleibt technisch (basis/pro/platin/enterprise) — Admin & Payload hängen daran.
       name ist NUR Anzeige-Label und wurde auf die neue Produktwelt umgestellt.
       situation = "Für dich, wenn …"-Zeile (Anzeige). */
    packages: [
      { id: 'basis', name: 'Start', price: 1290, scope: 'One-Pager', includedPages: 1,
        configurable: true, maintenanceFloor: 'care-s', popular: false,
        situation: 'Kunden dich nach einer Empfehlung googeln — und einen richtig guten Eindruck bekommen sollen.',
        perks: ['Alles Wichtige auf einer Seite', 'Mobil-optimiert & DSGVO-konform', '2 Korrekturrunden'] },
      { id: 'pro', name: 'Wachstum', price: 2990, scope: 'bis 8 Seiten', includedPages: 8,
        configurable: true, maintenanceFloor: 'care-m', popular: false,
        situation: 'deine Website aktiv neue Anfragen bringen soll — jede Leistung wird einzeln bei Google gefunden.',
        perks: ['Bis 8 Unterseiten, individuell', 'Jede Leistung wird bei Google gefunden', '3 Korrekturrunden'] },
      { id: 'platin', name: 'Platzhirsch', price: 5990, scope: 'bis 20 Seiten', includedPages: 20,
        configurable: true, maintenanceFloor: 'care-l', popular: true,
        situation: 'du in deiner Region die Nummer 1 sein willst — und auch Mitarbeiter über die Website finden möchtest.',
        perks: ['Bis 20 Seiten inkl. Team & Jobs', 'Kunden aus deiner Region finden dich', '4 Korrekturrunden'] },
      // Sonderprojekte = Abzweig, KEIN durchkonfigurierbarer Fixpreis (price: null).
      // priceFrom ist NUR Anzeige ("ab 9.990 €") und fließt bewusst NICHT in die Live-Berechnung ein.
      { id: 'enterprise', name: 'Sonderprojekte', price: null, priceFrom: 9990, scope: 'individuell', includedPages: null,
        configurable: false, maintenanceFloor: 'care-l', popular: false,
        perks: ['Individueller Seitenumfang', 'Sonderprogrammierung / Integrationen', 'Persönlicher Projektplan'] },
    ],

    /* ---- Fester Rundum-Schutz: Care gehört fix zum Paket (keine Auswahl mehr) ----
       Zuordnung über maintenanceFloor: Start→Care S, Wachstum→Care M, Platzhirsch→Care L,
       Sonderprojekte→individuell. Höhere Stufe bleibt auf Anfrage möglich.
       Im Verkauf heißt das Bündel "Rundum-Schutz"; die Stufennamen Care S/M/L bleiben. */
    careFixed: true,

    /* ---- Sartu Care — Hosting, Sicherheit & Wartung (monatlich, PFLICHT) ----
       Preise gelten bei Jahreszahlung. Pro Paket gilt ein Mindest-Care, Upgrade nach oben möglich. */
    maintenance: [
      { id: 'care-s', name: 'Care S', price: 49,
        perks: ['Hosting in Deutschland + SSL', 'Tägliche externe Backups · 30 Tage Aufbewahrung', 'Technische Sicherheits-Updates', 'Uptime-Monitoring im 5-Minuten-Takt'] },
      { id: 'care-m', name: 'Care M', price: 99, recommended: true,
        perks: ['Alles aus Care S', 'Auto-Update der Rechtstexte (eRecht24)', '30 Min. Änderungen / Monat', 'Erstreaktion innerhalb 1 Werktag'] },
      { id: 'care-l', name: 'Care L', price: 249,
        perks: ['Alles aus Care M', '90 Min. Änderungen / Monat', 'Staging-Tests vor Live-Schaltung', 'Quartals-Check der Core Web Vitals'] },
    ],
    maintenanceOrder: ['care-s', 'care-m', 'care-l'],
    mandatoryNote: 'Hosting & Pflege (Sartu Care) ist bei jeder Website Pflicht. Preise bei Jahreszahlung.',

    /* ---- Stundensatz für Arbeiten über die Inklusiv-Kontingente hinaus ----
       Wortlaut überall identisch. Minutengenau im 5-Minuten-Takt — keine
       Viertelstunden- oder Stunden-Aufrundung. */
    hourlyRate: 150,
    hourlyRateNote: '150 €/Std — minutengenau im 5-Minuten-Takt abgerechnet. Ab 30 Minuten geschätztem Umfang bekommst du vorher eine Kostenschätzung.',

    /* ---- „Nur das Design" — ohne Paket kaufbar (Code-Lieferung, kein Betrieb) ----
       Preise zentral hier; nirgends hart codieren. */
    designProducts: [
      { id: 'design-onepager', name: 'Onepager-Design', price: 990,
        scope: '1 Seite', desc: 'Fertiges Website-Design für eine Seite, geliefert als sauberer HTML/CSS-Code zum Selbst-Verwenden.' },
      { id: 'design-mehrseiten', name: 'Mehrseiten-Design', price: 1990,
        scope: 'bis 8 Seitentypen', desc: 'Design-System bis 8 Seitentypen (Startseite + Unterseiten-Layouts), geliefert als HTML/CSS.' },
    ],

    /* ---- Add-ons / Funktionen (aus der Leistungsbeschreibung) ----
       group  = Varianten-Gruppe: wird im Konfigurator als Karten NEBENEINANDER
                gerendert (wie Pakete/Wartung), nur EINE Variante gleichzeitig wählbar.
       short  = Kurzname für die Variante-Karte (Zusammenfassung nutzt den vollen Namen).
       monthly= Kombi-Add-on: zusätzlich zum Einmalpreis feste monatliche Kosten. */
    addons: [
      /* — Einmalig — */
      /* Texterstellung (Leistungsseite Texte): eine Variante wählen */
      { id: 'texte',        name: 'Texterstellung pro Seite', short: 'Einzelseite', price: 120, type: 'once', common: true, group: 'texte',
        qty: { min: 1, max: 10, default: 1, unit: 'pro Seite' }, desc: '300–500 Wörter je Seite, 2 Korrekturschleifen, Meta-Title + -Description.' },
      { id: 'texte-paket',  name: 'Texte-Paket (5 Seiten)', short: '5er-Paket', price: 490, type: 'once', common: true, group: 'texte',
        desc: 'Texte für 5 Seiten – ca. 98 €/Seite.' },
      { id: 'texte-paket10',name: 'Texte-Paket (10 Seiten)', short: '10er-Paket', price: 890, type: 'once', group: 'texte',
        desc: 'Texte für 10 Seiten – ca. 89 €/Seite.' },
      { id: 'texte-seo',    name: 'SEO-Option für Texte', price: 30, type: 'once',
        qty: { min: 1, max: 10, default: 1, unit: 'pro Seite' },
        desc: 'Keyword-Recherche (1 Haupt- + bis 3 Neben-Keywords), gezielte Platzierung in Title/H1/Text.' },
      /* Branding-Stufen (Leistungsseite Logo): eine Stufe wählen */
      { id: 'logo-lite',    name: 'Logo Lite', price: 490, type: 'once', common: true, group: 'branding',
        desc: '3 Entwürfe, 2 Korrekturrunden, alle Formate (SVG/EPS/PDF/PNG), Mini-Styleguide, volle Rechte.' },
      { id: 'branding-pro', name: 'Branding Pro', price: 990, type: 'once', common: true, group: 'branding',
        desc: 'Logo (3 Entwürfe, 3 Runden), Visitenkarte, Briefpapier, E-Mail-Signatur, Styleguide.' },
      { id: 'corporate',    name: 'Corporate Design', price: 1890, type: 'once', group: 'branding',
        desc: 'Designsystem, komplette Geschäftsausstattung, bis 5 Social-Templates, Styleguide (15+ S.).' },
      { id: 'terminbuchung',name: 'Online-Terminbuchung', price: 290, type: 'once', from: true, common: true,
        desc: 'Einrichtung 1 Buchungstool, 1 Kalender/Mitarbeiter, Bestätigungs- & Erinnerungsmail.' },
      { id: 'google-profil',name: 'Google-Profil-Setup', price: 290, type: 'once', common: true,
        desc: 'Einrichtung + Verifizierung, Hauptkategorie + bis 9 Zusatzkategorien, Beschreibung (bis 750 Z.), bis 10 Fotos, NAP-Konsistenz-Check.' },
      /* Kombi-Add-on: Einrichtung einmalig + Betrieb monatlich in EINER Option */
      { id: 'chatbot',      name: 'KI-Chatbot', price: 490, type: 'once', monthly: 49,
        desc: 'FAQ-Bot (EU/DSGVO) auf bis 20 Dokumente trainiert. 490 € Einrichtung + 49 €/Monat Betrieb (ca. 500 Gespräche/Mon. inkl.).' },
      { id: 'newsletter',   name: 'Newsletter-Anbindung', price: 290, type: 'once',
        desc: 'Anmeldeformular mit Double-Opt-In (DOI), Anbindung an dein Newsletter-Tool (EU/DSGVO).' },
      { id: 'analytics',    name: 'Analytics-/Tracking-Setup', price: 190, type: 'once', hidden: true,
        desc: 'GA4 oder Matomo (1 Property) + Search Console, Consent Mode v2, bis 3 Conversions/Events. DSGVO-konform an Cookie-Consent gekoppelt.' },
      { id: 'social-feed',  name: 'Bewertungs-/Social-Feed', price: 90, type: 'once', from: true,
        desc: 'Ein Feed (Google-Bewertungen ODER Instagram/Facebook) als DSGVO-Widget, einmalige Design-Einpassung.' },
      { id: 'migration',    name: 'Domain-Umzug / Migration', price: 190, type: 'once', from: true, hidden: true,
        desc: 'Transfer 1 Domain zum Sartu-Hosting, DNS + SSL, Redirects bestehender URLs, bis 3 E-Mail-Postfächer.' },
      { id: 'korrektur',    name: 'Zusätzliche Korrekturrunde', price: 140, type: 'once',
        qty: { min: 1, max: 5, default: 1, unit: 'pro Runde' }, desc: 'Ein gebündelter, schriftlicher Feedback-Durchlauf inkl. einmaliger Umsetzung.' },
      { id: 'mehrsprachig', name: 'Mehrsprachigkeit', price: null, type: 'percent', pct: 40, common: true,
        qty: { min: 1, max: 5, default: 1, unit: 'pro Sprache' },
        desc: 'Deine Website in mehreren Sprachen — komplett übersetzt und technisch sauber eingerichtet (Sprachumschalter, hreflang). +40 % je Sprache; Rechtstexte bleiben deutsch.' },
      { id: 'express',      name: 'Express-Lieferung', price: null, type: 'percent', pct: 50, min: 390,
        desc: 'Vorrang: Onepager in 5, Einzelseite/Text in 2 Werktagen ab vollständiger Inhaltslieferung (+50 %, mind. 390 €).' },

      /* — Wiederkehrend (monatlich) — */
      /* SEO-Betreuung als Retainer (Leistungsseite SEO): eine Stufe wählen */
      { id: 'seo-lite',     name: 'SEO-Betreuung Lite', short: 'Lite', price: 149, type: 'month', group: 'seo-betreuung',
        desc: 'Bis 5 Kernseiten (Title/Meta), Keyword-Tracking bis 10, Profil-Grundpflege, Monatsreport. 3 Mon. Mindestlaufzeit.' },
      { id: 'seo-pro',      name: 'SEO-Betreuung Pro', short: 'Pro', price: 390, type: 'month', group: 'seo-betreuung',
        desc: 'Alles aus Lite + OnPage aller Seiten, tiefe Keyword-Recherche, 2 Landingpages/Quartal, Tracking bis 30.' },
      { id: 'seo-premium',  name: 'SEO-Betreuung Premium', short: 'Premium', price: 790, type: 'month', group: 'seo-betreuung',
        desc: 'Alles aus Pro + Content-Strategie, bis 2 Backlinks/Mon., GEO/KI-Suche-Optimierung, Tracking bis 50.' },
      /* Google-Profil-Pflege (Leistungsseite Lokales SEO): eine Stufe wählen */
      { id: 'profil-basic', name: 'Google-Profil-Pflege Basic', short: 'Basic', price: 79, type: 'month', group: 'profil-pflege',
        desc: 'Alle Rezensionen (Erstreaktion ≤ 2 Werktage), Öffnungszeiten/Infos aktuell, Profil-Monitoring.' },
      { id: 'profil-pro',   name: 'Google-Profil-Pflege Pro', short: 'Pro', price: 149, type: 'month', group: 'profil-pflege',
        desc: 'Alles aus Basic + 2–4 Posts/Mon., bis 4 Fotos, Q&A-Management, Monatsreport.' },
    ],

    /* ---- Varianten-Gruppen: Überschrift + Hinweis für die Nebeneinander-Darstellung ---- */
    addonGroups: {
      'texte':         { label: 'Texterstellung',                  hint: 'eine Variante – erneut klicken zum Abwählen' },
      'branding':      { label: 'Logo & Branding',                 hint: 'eine Stufe – erneut klicken zum Abwählen' },
      'seo-betreuung': { label: 'SEO-Betreuung (monatlich)',       hint: 'eine Stufe – erneut klicken zum Abwählen' },
      'profil-pflege': { label: 'Google-Profil-Pflege (monatlich)',hint: 'eine Stufe – erneut klicken zum Abwählen' },
    },

    /* ---- Enterprise-Abzweig: Optionen für die strukturierte Anfrage ---- */
    enterpriseOptions: {
      sonderfunktionen: [
        { value: 'shop',         label: 'Shop / Bezahlung' },
        { value: 'login',        label: 'Login / Mitgliederbereich' },
        { value: 'buchung',      label: 'Buchungssystem' },
        { value: 'schnittstelle',label: 'Schnittstelle / CRM / API' },
        { value: 'mehrsprachig', label: 'Mehrsprachigkeit' },
        { value: 'portal',       label: 'Portal / Community' },
      ],
      seitenzahl: [
        { value: 'bis20', label: 'bis 20 Seiten' },
        { value: '20-50', label: '20–50 Seiten' },
        { value: '50plus', label: '50+ Seiten' },
        { value: 'unklar', label: 'Weiß ich noch nicht' },
      ],
      shopGroesse: [
        { value: 'bis50', label: 'bis 50 Produkte' },
        { value: '50-500', label: '50–500 Produkte' },
        { value: '500plus', label: '500+ Produkte' },
        { value: 'unklar', label: 'Weiß ich noch nicht' },
      ],
      zeithorizont: [
        { value: 'asap', label: 'So schnell wie möglich' },
        { value: '1-3m', label: 'In 1–3 Monaten' },
        { value: '3-6m', label: 'In 3–6 Monaten' },
        { value: 'flex', label: 'Flexibel' },
      ],
    },
    enterpriseTriggerFeatures: ['shop', 'login'],

    /* ---- Topf 3: "Festpreis im Angebot" — Wünsche OHNE öffentlichen Preis ----
       Werden nirgends mit Preis gezeigt. Begleitsatz überall:
       "Auch dafür bekommst du vorab einen Festpreis — schriftlich, bevor du zusagst."
       Im Konfigurator als anwählbare Chips (Payload-Key: wuensche). */
    onRequest: [
      { id: 'ki-assistent', name: 'KI-Assistent für deine Website',
        desc: 'Beantwortet Besucherfragen rund um die Uhr — trainiert auf deine eigenen Inhalte.' },
      { id: 'kundenbereich', name: 'Geschützter Kundenbereich / Login',
        desc: 'Ein passwortgeschützter Bereich für Kunden, Mitglieder oder Dokumente.' },
      { id: 'shop', name: 'Shop-Funktionen',
        desc: 'Produkte online verkaufen — mit Warenkorb und sicherer Bezahlung.' },
      { id: 'schnittstellen', name: 'Schnittstellen / Anbindungen',
        desc: 'Verbindung zu deinen Programmen (z. B. Warenwirtschaft, Kalender, CRM).' },
    ],
  };
});
