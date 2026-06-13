'use strict';
/* ============================================================
   EINZIGE Preis-Quelle des Portals (Etappe 5 Upsell, Kostenschätzung,
   Bau-Prompt). Werte IDENTISCH zur Website (Webagency-V3/pricing.js,
   Leistungsbeschreibung Stand Juni 2026). Abnahme #8 vergleicht diese
   Datei gegen die Website-Preise. NICHT abweichen — Single Source of Truth.
   ============================================================ */
module.exports = {
  hourlyRate: 150, // €/Std, minutengenau im 5-Minuten-Takt
  extraPage: 199,  // € je Seite über dem Inklusiv-Kontingent

  packages: {
    basis:      { name: 'Start',         price: 1290, includedPages: 1,  care: 'care-s', rundenMax: 2 },
    pro:        { name: 'Wachstum',      price: 2990, includedPages: 8,  care: 'care-m', rundenMax: 3 },
    platin:     { name: 'Platzhirsch',   price: 5990, includedPages: 20, care: 'care-l', rundenMax: 4 },
    enterprise: { name: 'Sonderprojekte', price: null, priceFrom: 9990,  care: 'care-l', rundenMax: 4 },
  },

  care: {
    'care-s': { name: 'Care S', price: 49,  minuten: 0 },
    'care-m': { name: 'Care M', price: 99,  minuten: 30 },
    'care-l': { name: 'Care L', price: 249, minuten: 90 },
  },

  // Nachbuchbare Extras (Etappe 5). type: once|percent|combo|month
  extras: {
    'logo-lite':     { name: 'Logo Lite',           price: 490, type: 'once' },
    'terminbuchung': { name: 'Online-Terminbuchung', price: 290, type: 'once' },
    'ki-assistent':  { name: 'KI-Chat-Assistent',    price: 990, monthly: 79, type: 'combo' },
    'newsletter':    { name: 'Newsletter-Anmeldung', price: 290, type: 'once' },
    'mehrsprachig':  { name: 'Mehrsprachigkeit',     pct: 40, type: 'percent' },
  },

  seo: {
    'seo-lite':    { name: 'SEO-Betreuung Lite',    price: 149, mindestlaufzeitMonate: 3 },
    'seo-pro':     { name: 'SEO-Betreuung Pro',     price: 390, mindestlaufzeitMonate: 3 },
    'seo-premium': { name: 'SEO-Betreuung Premium', price: 790, mindestlaufzeitMonate: 3 },
  },

  // €-Betrag einer Kostenschätzung: 150 €/Std anteilig (5-Minuten-Takt).
  estimateEuro(minuten) { return Math.round((this.hourlyRate / 60) * minuten); },
};
