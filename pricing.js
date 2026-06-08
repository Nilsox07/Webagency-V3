/* ============================================================
   Sartu · ZENTRALE PREISDATEN  (entspricht später /lib/pricing)
   ------------------------------------------------------------
   >>> EINZIGE Stelle zum Pflegen aller Preise. <<<
   Speist sowohl die Auswahl-Karten als auch die Live-Berechnung.
   Bitte Beträge gegenprüfen (Platzhalter-Hinweis: Wartungs- und
   Add-on-Preise hier bestätigen).

   Felder:
     price: Zahl in EUR (netto) ODER null = "auf Anfrage"
     from:  true → Preis ist ein "ab"-Preis
     type (Add-on): 'once' = einmalig | 'month' = monatlich
     qty:   optional → Mengen-Add-on {min,max,default,unit}
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

    /* ---- Pakete (einmalig) ---- */
    packages: [
      { id: 'basis',      name: 'Basis',      price: 1290, scope: 'One-Pager',     popular: false },
      { id: 'pro',        name: 'Pro',        price: 2990, scope: 'bis 8 Seiten',  popular: true },
      { id: 'platin',     name: 'Platin',     price: 5990, scope: 'bis 20 Seiten', popular: false },
      { id: 'enterprise', name: 'Enterprise', price: 9990, scope: 'individuell',   popular: false, from: true },
    ],

    /* ---- Wartung / Hosting (monatlich) ---- */
    maintenance: [
      { id: 'wartung-basis',      name: 'Basis-Wartung',      price: 49 },
      { id: 'wartung-pro',        name: 'Pro-Wartung',        price: 99 },
      { id: 'wartung-platin',     name: 'Platin-Wartung',     price: 299 },
      { id: 'wartung-enterprise', name: 'Enterprise-Wartung', price: 499, from: true },
      { id: 'none',               name: 'Keine Wartung',      price: 0 },
    ],
    // Paketabhängige Default-Empfehlung (abwählbar)
    maintenanceDefault: {
      basis: 'wartung-basis',
      pro: 'wartung-pro',
      platin: 'wartung-platin',
      enterprise: 'wartung-enterprise',
    },
    // Was bei "Keine Wartung" entfällt (dezenter Hinweis)
    maintenanceDropHint: 'Ohne Wartung entfallen Hosting, Updates, Backups und Support.',

    /* ---- Add-ons ---- */
    addons: [
      { id: 'logo',          name: 'Logo / Wort-Bild-Marke',  price: 390, type: 'once', from: true,
        desc: 'Professionelle Wortmarke oder Wort-Bild-Marke.' },
      { id: 'texte',         name: 'Zusätzliche Texte',       price: 120, type: 'once',
        qty: { min: 1, max: 10, default: 1, unit: 'pro Seite' },
        desc: 'Verkaufsstarke, SEO-optimierte Texte je Seite.' },
      { id: 'terminbuchung', name: 'Online-Terminbuchung',    price: 290, type: 'once',
        desc: 'Kalender-Integration für Termine/Buchungen.' },
      { id: 'chatbot',       name: 'KI-Chatbot',              price: 490, type: 'once',
        desc: 'Automatische Antworten auf Standardfragen.' },
      { id: 'galerie',       name: 'Bildergalerie',           price: 190, type: 'once',
        desc: 'Filterbare Galerie für Referenzen/Portfolio.' },
      { id: 'newsletter',    name: 'Newsletter-Anbindung',    price: 240, type: 'once',
        desc: 'Anmeldeformular + Anbindung an dein Tool.' },
      { id: 'mehrsprachig',  name: 'Mehrsprachigkeit',        price: null, type: 'once', onRequest: true,
        desc: 'Weitere Sprachversion — Preis nach Umfang.' },
      { id: 'content-pflege',name: 'Content-Pflege',          price: 90,  type: 'month',
        desc: 'Monatlich 1 redaktioneller Beitrag, gepflegt von uns.' },
    ],
  };
});
