/* ============================================================
   Sartu · ZENTRALE PREISDATEN  (entspricht später /lib/pricing)
   ------------------------------------------------------------
   >>> EINZIGE Stelle zum Pflegen aller Preise. <<<
   Speist die Auswahl-Karten UND die Live-Berechnung.
   Add-on-Liste ist 1:1 mit der Preise-Seite (preise.html) abgeglichen.
   Bitte Beträge gegenprüfen.

   Add-on-Felder:
     price: Zahl EUR (netto) | null (z. B. bei type 'percent')
     type:  'once' = einmalig | 'month' = monatlich | 'percent' = % vom Paketpreis
     pct:   nur bei type 'percent' (z. B. 20)
     from:  true → "ab"-Preis (Untergrenze; rechnet mit Untergrenze)
     qty:   Mengen-Add-on {min,max,default,unit}
     common:true → in der kurzen Standardliste sichtbar (Rest hinter "mehr")
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

    /* ---- Pakete (einmalig) — mit 2–3 Kurz-Vorteilen ---- */
    packages: [
      { id: 'basis', name: 'Basis', price: 1290, scope: 'One-Pager', popular: false,
        perks: ['Alles Wichtige auf einer Seite', 'Mobil-optimiert & DSGVO-konform', 'In 7 Tagen online'] },
      { id: 'pro', name: 'Pro', price: 2990, scope: 'bis 8 Seiten', popular: true,
        perks: ['Bis 8 Seiten, individuelles Design', 'Onpage-SEO & schnelle Ladezeit', '3 Korrekturrunden'] },
      { id: 'platin', name: 'Platin', price: 5990, scope: 'bis 20 Seiten', popular: false,
        perks: ['Bis 20 Seiten inkl. Blog', 'Lokales SEO inklusive', '4 Korrekturrunden'] },
      { id: 'enterprise', name: 'Enterprise', price: 9990, scope: 'individuell', popular: false, from: true,
        perks: ['Individueller Funktionsumfang', 'Mehrsprachig, Login, Schnittstellen', 'Feste Ansprechperson'] },
    ],

    /* ---- Wartung / Hosting (monatlich) — mit Kurz-Vorteilen ---- */
    maintenance: [
      { id: 'wartung-basis', name: 'Basis-Wartung', price: 49,
        perks: ['Hosting in DE, SSL, Backups', 'Updates & Sicherheit'] },
      { id: 'wartung-pro', name: 'Pro-Wartung', price: 99,
        perks: ['Alles aus Basis', '30 Min Änderungen / Monat'] },
      { id: 'wartung-platin', name: 'Platin-Wartung', price: 299,
        perks: ['90 Min Änderungen / Monat', 'Monitoring & Reports'] },
      { id: 'wartung-enterprise', name: 'Enterprise-Wartung', price: 499, from: true,
        perks: ['SLA & feste Ansprechperson', 'Erweiterte Sicherheit'] },
      { id: 'hosting-only', name: 'Hosting-Only', price: 19, from: true,
        perks: ['Nur Hosting & SSL', 'Ohne Pflege & Support'] },
      { id: 'none', name: 'Keine Wartung', price: 0, perks: [] },
    ],
    // Paketabhängige Default-Empfehlung (abwählbar)
    maintenanceDefault: {
      basis: 'wartung-basis',
      pro: 'wartung-pro',
      platin: 'wartung-platin',
      enterprise: 'wartung-enterprise',
    },
    maintenanceDropHint: 'Ohne Wartung entfallen Hosting, Updates, Backups und Support.',

    /* ---- Add-ons (vollständig wie auf der Preise-Seite) ---- */
    addons: [
      /* — Einmalig — */
      { id: 'texte',        name: 'Texterstellung pro Seite', price: 120, type: 'once', common: true,
        qty: { min: 1, max: 10, default: 1, unit: 'pro Seite' },
        desc: 'Verkaufsstarke, SEO-optimierte Texte je Seite.' },
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
      { id: 'unterseite',   name: 'Zusätzliche Unterseite', price: 190, type: 'once', from: true,
        qty: { min: 1, max: 20, default: 1, unit: 'pro Seite' },
        desc: 'Weitere individuell gestaltete Unterseite.' },
      { id: 'blog',         name: 'Blog-/News-Bereich', price: 590, type: 'once', from: true,
        desc: 'Redaktionsfähiger Blog-Bereich.' },
      { id: 'newsletter',   name: 'Newsletter-Einrichtung', price: 290, type: 'once',
        desc: 'Anmeldeformular + Anbindung an dein Tool.' },
      { id: 'analytics',    name: 'Analytics & Tracking', price: 190, type: 'once',
        desc: 'DSGVO-konformes Tracking-Setup.' },
      { id: 'google-ads',   name: 'Google-Ads-Setup', price: 390, type: 'once',
        desc: 'Grundeinrichtung deiner Kampagnen.' },
      { id: 'sprache',      name: 'Zusätzliche Sprache', price: 490, type: 'once',
        qty: { min: 1, max: 5, default: 1, unit: 'pro Sprache' },
        desc: 'Weitere vollständige Sprachversion.' },
      { id: 'foto',         name: 'Fotooptimierung / KI-Bildbearbeitung', price: 90, type: 'once', from: true,
        desc: 'Bilder optimiert & aufbereitet.' },
      { id: 'migration',    name: 'Domain-Umzug / Migration', price: 190, type: 'once', from: true,
        desc: 'Umzug deiner bestehenden Website.' },
      { id: 'korrektur',    name: 'Zusätzliche Korrekturrunde', price: 90, type: 'once',
        qty: { min: 1, max: 5, default: 1, unit: 'pro Runde' },
        desc: 'Eine weitere vollständige Feedback-Runde.' },
      { id: 'express',      name: 'Express (Lieferung in 7 Tagen)', price: null, type: 'percent', pct: 20,
        desc: 'Priorisierte Umsetzung – +20 % auf den Paketpreis.' },

      /* — Wiederkehrend (monatlich) — */
      { id: 'local-seo',    name: 'Local-SEO Light', price: 99, type: 'month', from: true,
        desc: 'Profil-Pflege, 1 Post/Monat, Bewertungs-Monitoring.' },
      { id: 'chatbot',      name: 'KI-Chatbot (Betrieb & Pflege)', price: 39, type: 'month',
        desc: 'Laufender Betrieb des KI-Chatbots.' },
      { id: 'aenderung-30', name: 'Änderungs-Kontingent +30 Min', price: 29, type: 'month',
        desc: 'Zusätzliche Änderungszeit pro Monat.' },
      { id: 'aenderung-60', name: 'Änderungs-Kontingent +1 Std', price: 49, type: 'month',
        desc: 'Zusätzliche Änderungszeit pro Monat.' },
    ],
  };
});
