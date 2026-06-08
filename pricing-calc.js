/* ============================================================
   Sartu · PREIS-BERECHNUNG (Live-Summen)
   ------------------------------------------------------------
   Reine Frontend-Logik, KEIN LLM. Wird von briefing.js (Browser)
   UND von pricing.test.js (Node) genutzt — dadurch testen die Tests
   exakt die Funktion, die live läuft.

   Trennt strikt zwei Summen:
     once    = Paket + einmalige Add-ons (× Menge)
     monthly = Wartung + monatliche Add-ons (× Menge)
   "auf Anfrage"-Add-ons (price === null) zählen NICHT in die Summe.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  root.SARTU_PRICING_CALC = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function clampQty(a, q) {
    if (!a.qty) return 1;
    var n = q == null ? a.qty.default : q;
    return Math.max(a.qty.min, Math.min(a.qty.max, n));
  }

  /**
   * @param {{paket:string, wartung:string, addons:Object}} state
   * @param {Object} pricing  window.SARTU_PRICING
   * @returns {{once:number, monthly:number, lines:Array}}
   */
  function computeTotals(state, pricing) {
    var once = 0, monthly = 0;
    var lines = [];

    // Paket (einmalig)
    var pkg = pricing.packages.filter(function (p) { return p.id === state.paket; })[0];
    if (pkg && typeof pkg.price === 'number') {
      once += pkg.price;
      lines.push({ group: 'once', label: pkg.name + ' (Paket)', amount: pkg.price });
    }

    // Wartung (monatlich)
    var w = pricing.maintenance.filter(function (m) { return m.id === state.wartung; })[0];
    if (w && typeof w.price === 'number' && w.price > 0) {
      monthly += w.price;
      lines.push({ group: 'monthly', label: w.name, amount: w.price });
    }

    // Add-ons
    pricing.addons.forEach(function (a) {
      var st = state.addons && state.addons[a.id];
      if (!st || !st.selected) return;
      if (typeof a.price !== 'number') return; // "auf Anfrage" → nicht summieren
      var qty = clampQty(a, st.qty);
      var amount = a.price * qty;
      var label = a.name + (a.qty ? ' × ' + qty : '');
      if (a.type === 'month') {
        monthly += amount;
        lines.push({ group: 'monthly', label: label, amount: amount });
      } else {
        once += amount;
        lines.push({ group: 'once', label: label, amount: amount });
      }
    });

    return { once: once, monthly: monthly, lines: lines };
  }

  return { computeTotals: computeTotals, clampQty: clampQty };
});
