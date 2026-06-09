/* ============================================================
   Sartu · ZENTRALE PREISDATEN  (entspricht später /lib/pricing)
   ------------------------------------------------------------
   >>> EINZIGE Pflegestelle. Werte 1:1 aus der Leistungsbeschreibung
       (Sartu — Leistungsbeschreibung, Version 1.0, Stand Juni 2026). <<<
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

    /* ---- Pakete (einmalig) ---- */
    packages: [
      { id: 'basis', name: 'Basis', price: 1290, scope: 'One-Pager', includedPages: 1,
        configurable: true, maintenanceFloor: 'care-s', popular: false,
        perks: ['Alles Wichtige auf einer Seite', 'Mobil-optimiert & DSGVO-konform', '2 Korrekturrunden'] },
      { id: 'pro', name: 'Pro', price: 2990, scope: 'bis 8 Seiten', includedPages: 8,
        configurable: true, maintenanceFloor: 'care-m', popular: false,
        perks: ['Bis 8 Unterseiten, individuell', 'OnPage-SEO für alle Seiten', '3 Korrekturrunden'] },
      { id: 'platin', name: 'Platin', price: 5990, scope: 'bis 20 Seiten', includedPages: 20,
        configurable: true, maintenanceFloor: 'care-l', popular: true,
        perks: ['Bis 20 Seiten', 'Lokales SEO inkl. Google-Profil-Setup', '4 Korrekturrunden'] },
      // Enterprise = Abzweig, KEIN durchkonfigurierbarer Fixpreis (price: null)
      { id: 'enterprise', name: 'Enterprise', price: null, scope: 'individuell', includedPages: null,
        configurable: false, maintenanceFloor: 'care-l', popular: false,
        perks: ['Individueller Seitenumfang', 'Sonderprogrammierung / Integrationen', 'Persönlicher Projektplan'] },
    ],

    /* ---- Sartu Care — Hosting, Sicherheit & Wartung (monatlich, PFLICHT) ----
       Preise gelten bei Jahreszahlung. Pro Paket gilt ein Mindest-Care, Upgrade nach oben möglich. */
    maintenance: [
      { id: 'care-s', name: 'Care S', price: 49,
        perks: ['Hosting in Deutschland + SSL', 'Automatische Backups', 'Software- & Sicherheitsupdates', 'Echtzeit-Sicherheitsmonitoring'] },
      { id: 'care-m', name: 'Care M', price: 99, recommended: true,
        perks: ['Alles aus Care S', 'Auto-Update der Rechtstexte (eRecht24)', '30 Min. Änderungen / Monat', 'Schnellere Reaktionszeit'] },
      { id: 'care-l', name: 'Care L', price: 249,
        perks: ['Alles aus Care M', '90 Min. Änderungen / Monat', 'Staging-Tests vor Live-Updates', 'Reaktion innerhalb 1 Werktag'] },
    ],
    maintenanceOrder: ['care-s', 'care-m', 'care-l'],
    mandatoryNote: 'Hosting & Pflege (Sartu Care) ist bei jeder Website Pflicht. Preise bei Jahreszahlung.',

    /* ---- Add-ons / Funktionen (aus der Leistungsbeschreibung) ---- */
    addons: [
      /* — Einmalig — */
      { id: 'texte',        name: 'Texterstellung pro Seite', price: 120, type: 'once', common: true,
        qty: { min: 1, max: 10, default: 1, unit: 'pro Seite' }, desc: 'Professioneller Text je Seite, eine Korrekturrunde.' },
      { id: 'texte-paket',  name: 'Texte-Paket (5 Seiten)', price: 490, type: 'once', common: true,
        desc: 'Texte für 5 Seiten – ca. 98 €/Seite.' },
      { id: 'texte-paket10',name: 'Texte-Paket (10 Seiten)', price: 890, type: 'once',
        desc: 'Texte für 10 Seiten – ca. 89 €/Seite.' },
      { id: 'logo-lite',    name: 'Logo Lite', price: 490, type: 'once', common: true,
        desc: '3 Entwürfe, 2 Runden, Standardformate, Mini-Styleguide.' },
      { id: 'branding-pro', name: 'Branding Pro', price: 990, type: 'once', common: true,
        desc: 'Individuelles Logo, Visitenkarte, Briefpapier, Styleguide.' },
      { id: 'corporate',    name: 'Corporate Design', price: 1890, type: 'once',
        desc: 'Umfassendes Designsystem + komplette Geschäftsausstattung.' },
      { id: 'terminbuchung',name: 'Online-Terminbuchung', price: 290, type: 'once', from: true, common: true,
        desc: 'Einrichtung & Einbindung eines Buchungstools.' },
      { id: 'google-profil',name: 'Google-Profil-Setup', price: 290, type: 'once', common: true,
        desc: 'Einmalige Einrichtung & Optimierung des Profils.' },
      { id: 'chatbot',      name: 'KI-Chatbot (Einrichtung)', price: 490, type: 'once',
        desc: 'FAQ-Bot auf Basis deiner Website-Inhalte. Betrieb: siehe monatlich.' },
      { id: 'newsletter',   name: 'Newsletter-Anbindung', price: 290, type: 'once',
        desc: 'Anmeldeformular + Anbindung an dein Newsletter-Tool.' },
      { id: 'analytics',    name: 'Analytics-/Tracking-Setup', price: 190, type: 'once',
        desc: 'GA4 oder Matomo + Search Console, DSGVO-konform an Consent gekoppelt.' },
      { id: 'social-feed',  name: 'Bewertungs-/Social-Feed', price: 90, type: 'once', from: true,
        desc: 'Einbindung von Google-Bewertungen oder Social-Feed.' },
      { id: 'migration',    name: 'Domain-Umzug / Migration', price: 190, type: 'once', from: true,
        desc: 'Umzug Domain bzw. Migration der alten Seite.' },
      { id: 'korrektur',    name: 'Zusätzliche Korrekturrunde', price: 140, type: 'once',
        qty: { min: 1, max: 5, default: 1, unit: 'pro Runde' }, desc: 'Eine weitere vollständige Feedback-Runde.' },
      { id: 'mehrsprachig', name: 'Mehrsprachigkeit', price: null, type: 'percent', pct: 40,
        qty: { min: 1, max: 5, default: 1, unit: 'pro Sprache' },
        desc: '+40 % je zusätzliche Sprache (technische Einrichtung; Übersetzung extra).' },
      { id: 'express',      name: 'Express-Lieferung', price: null, type: 'percent', pct: 50, min: 390,
        desc: 'Priorisierte, schnellere Fertigstellung (+50 %, mind. 390 €).' },

      /* — Wiederkehrend (monatlich) — */
      { id: 'chatbot-betrieb', name: 'KI-Chatbot (Betrieb & Pflege)', price: 49, type: 'month',
        desc: 'Laufender Betrieb des Chatbots (zzgl. Einrichtung).' },
      { id: 'seo-lite',     name: 'SEO-Betreuung (Lite)', price: 149, type: 'month', from: true,
        desc: 'Basis-Local-SEO, Profil-Grundpflege, Title/Meta, Monatsreport. Höhere Stufen auf der SEO-Seite.' },
      { id: 'profil-basic', name: 'Google-Profil-Pflege (Basic)', price: 79, type: 'month', from: true,
        desc: 'Rezensionen beantworten, Kerninfos pflegen, Monitoring.' },
    ],

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
  };
});
