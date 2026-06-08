/* ============================================================
   Sartu · ZENTRALE PREISDATEN  (entspricht später /lib/pricing)
   ------------------------------------------------------------
   >>> EINZIGE Pflegestelle. Werte 1:1 aus preise.html übernommen. <<<
   Speist Konfigurator-Karten UND Live-Berechnung.

   Übernommen aus preise.html:
     Pakete:   Basis 1.290 € (One-Pager / 1 Seite), Pro 2.990 € (bis 8),
               Platin 5.990 € (bis 20), Enterprise ab 9.990 € (individuell)
     Wartung:  Basis 69 €/Mon (49 € jährl.), Plus 149 €/Mon (119 € jährl.),
               Premium ab 299 €/Mon  — Hosting/Wartung ist PFLICHT
     Extraseite: ab 190 € pro Seite (Add-on-Liste)
     Add-ons:  siehe unten (alle aus der Aufpreisliste)

   [PRÜFEN] = Wert/Logik nicht eindeutig aus preise.html ableitbar,
             bitte bestätigen (statt geraten).
   ============================================================ */
(function (root, factory) {
  var api = factory();
  root.SARTU_PRICING = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  return {
    currency: '€',
    taxNote: 'Alle Preise netto zzgl. MwSt.',

    /* ---- Extraseite (Variante A): Inklusiv-Kontingent je Paket + Festpreis je weiterer Seite ---- */
    extraPage: { price: 190, from: true, label: 'Zusätzliche Seite' }, // preise.html: „Zusätzliche Unterseite ab 190 €"

    /* ---- Pakete (einmalig) ---- */
    packages: [
      { id: 'basis', name: 'Basis', price: 1290, scope: 'One-Pager', includedPages: 1,
        configurable: true, maintenanceFloor: 'wartung-basis', popular: false,
        perks: ['Alles Wichtige auf einer Seite', 'Mobil-optimiert & DSGVO-konform', 'In 7 Tagen online'] },
      { id: 'pro', name: 'Pro', price: 2990, scope: 'bis 8 Seiten', includedPages: 8,
        configurable: true, maintenanceFloor: 'wartung-basis', popular: false, // [PRÜFEN] Wartungs-Floor je Paket
        perks: ['Individuelles Design statt Vorlage', 'Onpage-SEO & schnelle Ladezeit', '3 Korrekturrunden'] },
      { id: 'platin', name: 'Platin', price: 5990, scope: 'bis 20 Seiten', includedPages: 20,
        configurable: true, maintenanceFloor: 'wartung-plus', popular: true, // [PRÜFEN] Wartungs-Floor je Paket
        perks: ['Bis 20 Seiten inkl. Blog', 'Lokales SEO inklusive', '4 Korrekturrunden'] },
      // Enterprise = Abzweig, KEIN durchkonfigurierbarer Fixpreis (price: null)
      { id: 'enterprise', name: 'Enterprise', price: null, scope: 'individuell', includedPages: null,
        configurable: false, maintenanceFloor: 'wartung-premium', popular: false, // [PRÜFEN] Floor
        perks: ['Individueller Funktionsumfang', 'Shop, Login, Mehrsprachig, Schnittstellen', 'Festpreis-Angebot nach Erstgespräch'] },
    ],

    /* ---- Wartung / Hosting (monatlich, PFLICHT — keine "Keine Wartung"-Option) ----
       Standard-Monatspreis verwendet (49/119 € gelten nur bei Jahreszahlung). */
    maintenance: [
      { id: 'wartung-basis',   name: 'Basis-Wartung',   price: 69,  yearly: 49,
        perks: ['Hosting in DE, SSL, Backups', 'Updates & Sicherheit', 'E-Mail-Support'] },
      { id: 'wartung-plus',    name: 'Plus-Wartung',    price: 149, yearly: 119, recommended: true,
        perks: ['Alles aus Basis', '30 Min Änderungen / Monat', 'Support + Telefon, Monitoring'] },
      { id: 'wartung-premium', name: 'Premium-Wartung', price: 299, from: true,
        perks: ['Alles aus Plus', '90 Min Änderungen / Monat', 'Priorisiert + Local-SEO inkl.'] },
    ],
    maintenanceOrder: ['wartung-basis', 'wartung-plus', 'wartung-premium'],
    mandatoryNote: 'Hosting & Wartung ist fester Bestandteil jedes Pakets.',

    /* ---- Add-ons (aus der Aufpreisliste preise.html) ---- */
    addons: [
      /* — Einmalig — */
      { id: 'texte',        name: 'Texterstellung pro Seite', price: 120, type: 'once', common: true,
        qty: { min: 1, max: 10, default: 1, unit: 'pro Seite' }, desc: 'Verkaufsstarke, SEO-optimierte Texte je Seite.' },
      { id: 'texte-paket',  name: 'Texte-Komplettpaket (5 Seiten)', price: 490, type: 'once', common: true,
        desc: 'Texte für 5 Seiten – günstiger als einzeln.' },
      { id: 'logo-wort',    name: 'Logo – Wortmarke', price: 390, type: 'once', common: true,
        desc: 'Professionelle Wortmarke.' },
      { id: 'logo-wortbild',name: 'Logo – Wort-Bild-Marke', price: 690, type: 'once', common: true,
        desc: 'Wortmarke plus Bildzeichen.' },
      { id: 'terminbuchung',name: 'Online-Terminbuchung', price: 290, type: 'once', common: true,
        desc: 'Kalender für Termine & Buchungen.' },
      { id: 'google-profil',name: 'Google-Unternehmensprofil', price: 350, type: 'once', common: true,
        desc: 'Einrichtung für lokale Sichtbarkeit.' },
      { id: 'blog',         name: 'Blog-/News-Bereich', price: 590, type: 'once', from: true,
        desc: 'Redaktionsfähiger Blog-Bereich.' },
      { id: 'newsletter',   name: 'Newsletter-Einrichtung', price: 290, type: 'once', desc: 'Anmeldeformular + Tool-Anbindung.' },
      { id: 'analytics',    name: 'Analytics & Tracking', price: 190, type: 'once', desc: 'DSGVO-konformes Tracking-Setup.' },
      { id: 'google-ads',   name: 'Google-Ads-Setup', price: 390, type: 'once', desc: 'Grundeinrichtung deiner Kampagnen.' },
      { id: 'sprache',      name: 'Zusätzliche Sprache', price: 490, type: 'once',
        qty: { min: 1, max: 5, default: 1, unit: 'pro Sprache' }, desc: 'Weitere vollständige Sprachversion.' },
      { id: 'foto',         name: 'Fotooptimierung / KI-Bildbearbeitung', price: 90, type: 'once', from: true, desc: 'Bilder optimiert & aufbereitet.' },
      { id: 'migration',    name: 'Domain-Umzug / Migration', price: 190, type: 'once', from: true, desc: 'Umzug deiner bestehenden Website.' },
      { id: 'korrektur',    name: 'Zusätzliche Korrekturrunde', price: 90, type: 'once',
        qty: { min: 1, max: 5, default: 1, unit: 'pro Runde' }, desc: 'Eine weitere vollständige Feedback-Runde.' },
      { id: 'express',      name: 'Express (Lieferung in 7 Tagen)', price: null, type: 'percent', pct: 20,
        desc: 'Priorisierte Umsetzung – +20 % auf den Paketpreis.' },

      /* — Wiederkehrend (monatlich) — */
      { id: 'local-seo',    name: 'Local-SEO Light', price: 99, type: 'month', from: true, desc: 'Profil-Pflege, 1 Post/Monat, Monitoring.' },
      { id: 'chatbot',      name: 'KI-Chatbot (Betrieb & Pflege)', price: 39, type: 'month', desc: 'Laufender Betrieb des KI-Chatbots.' },
      { id: 'aenderung-30', name: 'Änderungs-Kontingent +30 Min', price: 29, type: 'month', desc: 'Zusätzliche Änderungszeit pro Monat.' },
      { id: 'aenderung-60', name: 'Änderungs-Kontingent +1 Std', price: 49, type: 'month', desc: 'Zusätzliche Änderungszeit pro Monat.' },
    ],

    /* ---- Enterprise-Abzweig: Optionen für die strukturierte Anfrage ---- */
    enterpriseOptions: {
      sonderfunktionen: [
        { value: 'shop',        label: 'Shop / Bezahlung' },
        { value: 'login',       label: 'Login / Mitgliederbereich' },
        { value: 'buchung',     label: 'Buchungssystem' },
        { value: 'schnittstelle',label: 'Schnittstelle / CRM / API' },
        { value: 'mehrsprachig',label: 'Mehrsprachigkeit' },
        { value: 'portal',      label: 'Portal / Community' },
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
    // Funktionen, die generell den Enterprise-Abzweig auslösen
    enterpriseTriggerFeatures: ['shop', 'login'],
  };
});
