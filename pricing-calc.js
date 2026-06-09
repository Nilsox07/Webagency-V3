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
   * @param {{paket:string, wartung:string, addons:Object, extraPages:number}} state
   * @param {Object} pricing  window.SARTU_PRICING
   * @returns {{once:number, monthly:number, lines:Array}}
   */
  function computeTotals(state, pricing) {
    var once = 0, monthly = 0;
    var lines = [];

    // Paket (einmalig) — Enterprise hat price null → zählt nicht (individuelles Angebot)
    var pkg = pricing.packages.filter(function (p) { return p.id === state.paket; })[0];
    if (pkg && typeof pkg.price === 'number') {
      once += pkg.price;
      lines.push({ group: 'once', label: pkg.name + ' (Paket)', amount: pkg.price });
    }

    // Extraseiten (Variante A): jede Seite über dem Inklusiv-Kontingent
    var extra = Math.max(0, parseInt(state.extraPages, 10) || 0);
    if (extra > 0 && pricing.extraPage && typeof pricing.extraPage.price === 'number') {
      var extraAmount = pricing.extraPage.price * extra;
      once += extraAmount;
      lines.push({ group: 'once', label: 'Zusätzliche Seiten × ' + extra, amount: extraAmount });
    }

    // Wartung (monatlich, Pflicht)
    var w = pricing.maintenance.filter(function (m) { return m.id === state.wartung; })[0];
    if (w && typeof w.price === 'number' && w.price > 0) {
      monthly += w.price;
      lines.push({ group: 'monthly', label: w.name, amount: w.price });
    }

    // Add-ons
    pricing.addons.forEach(function (a) {
      var st = state.addons && state.addons[a.id];
      if (!st || !st.selected) return;

      // Prozent-Add-on: Express (+50 %, mind. min) bzw. Mehrsprachigkeit (+40 % je Sprache)
      if (a.type === 'percent') {
        var base = pkg && typeof pkg.price === 'number' ? pkg.price : 0;
        var per = Math.round(base * (a.pct || 0) / 100);
        var pqty = a.qty ? clampQty(a, st.qty) : 1;
        var pamount = per * pqty;
        if (typeof a.min === 'number') pamount = Math.max(a.min, pamount); // Mindestbetrag (z. B. Express min. 390 €)
        if (pamount > 0) {
          once += pamount;
          var plabel = a.name + ' (+' + a.pct + ' %' + (a.qty ? ' × ' + pqty : '') + ')';
          lines.push({ group: 'once', label: plabel, amount: pamount });
        }
        return;
      }

      if (typeof a.price !== 'number') return; // ohne Festpreis → nicht summieren
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
