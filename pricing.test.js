/* ============================================================
   Sartu · Tests für die Live-Preisberechnung
   Lauf:  node pricing.test.js
   Testet exakt die Funktion, die auch im Browser rechnet
   (pricing-calc.js gegen die zentralen Daten in pricing.js).
   ============================================================ */
'use strict';
var PRICING = require('./pricing.js');
var PAY = require('./payment-terms.js');
var CALC = require('./pricing-calc.js');

var fails = 0;
function eq(label, got, want) {
  var ok = got === want;
  if (!ok) fails++;
  console.log((ok ? '✓' : '✗ FAIL') + '  ' + label + '  →  got ' + got + (ok ? '' : ', want ' + want));
}
// Hilfsfunktion: Add-on-State bauen
function addons(map) {
  var out = {};
  PRICING.addons.forEach(function (a) { out[a.id] = { selected: false, qty: a.qty ? a.qty.default : 1 }; });
  Object.keys(map || {}).forEach(function (id) {
    out[id] = { selected: true, qty: map[id] === true ? (out[id].qty) : map[id] };
  });
  return out;
}
function t(state) { return CALC.computeTotals(state, PRICING); }

console.log('— Preis-Tests —');

// 1) Basis + Basis-Wartung, keine Add-ons
var r1 = t({ paket: 'basis', wartung: 'wartung-basis', addons: addons({}) });
eq('Basis einmalig', r1.once, 1290);
eq('Basis monatlich', r1.monthly, 49);

// 2) Pro + Pro-Wartung + Logo-Wortmarke (390) + Texte ×3 (120×3)
var r2 = t({ paket: 'pro', wartung: 'wartung-pro', addons: addons({ 'logo-wort': true, texte: 3 }) });
eq('Pro+Logo+Texte×3 einmalig', r2.once, 2990 + 390 + 360);
eq('Pro+Logo+Texte×3 monatlich', r2.monthly, 99);

// 3) Platin + keine Wartung + KI-Chatbot (39/Mon) + Terminbuchung (290 einmalig)
var r3 = t({ paket: 'platin', wartung: 'none', addons: addons({ chatbot: true, terminbuchung: true }) });
eq('Platin einmalig (Termin)', r3.once, 5990 + 290);
eq('Platin monatlich (Chatbot, keine Wartung)', r3.monthly, 39);

// 4) Enterprise + Enterprise-Wartung + Zusätzliche Sprache ×2 (490×2)
var r4 = t({ paket: 'enterprise', wartung: 'wartung-enterprise', addons: addons({ sprache: 2 }) });
eq('Enterprise einmalig (Sprache ×2)', r4.once, 9990 + 980);
eq('Enterprise monatlich', r4.monthly, 499);

// 5) Mengen-Clamp: Texte ×20 → max 10
var r5 = t({ paket: 'basis', wartung: 'none', addons: addons({ texte: 20 }) });
eq('Texte ×20 → geclamped auf 10 (120×10)', r5.once, 1290 + 1200);

// 6) Abgewähltes Add-on zählt nicht
var st6 = addons({ 'logo-wort': true }); st6['logo-wort'].selected = false;
var r6 = t({ paket: 'basis', wartung: 'none', addons: st6 });
eq('Abgewähltes Add-on zählt nicht', r6.once, 1290);

// 7) Express = +20 % vom Paketpreis (Pro 2990 → +598)
var r7 = t({ paket: 'pro', wartung: 'none', addons: addons({ express: true }) });
eq('Express +20 % auf Pro (2990→+598)', r7.once, 2990 + 598);
eq('Express ohne Monatskosten', r7.monthly, 0);

// 8) Zusätzliche Unterseite ×3 (190×3)
var r8 = t({ paket: 'basis', wartung: 'none', addons: addons({ unterseite: 3 }) });
eq('Unterseite ×3 (190×3)', r8.once, 1290 + 570);

// 9) Local-SEO Light (monatlich, ab 99)
var r9 = t({ paket: 'platin', wartung: 'wartung-platin', addons: addons({ 'local-seo': true }) });
eq('Local-SEO monatlich (99) + Platin-Wartung (299)', r9.monthly, 299 + 99);

// 7) Zahlungsstaffelung: Prozente ergeben 100 %
['basis', 'pro', 'platin', 'enterprise'].forEach(function (id) {
  var sum = PAY.forPackage(id).reduce(function (s, x) { return s + x.pct; }, 0);
  eq('Staffelung ' + id + ' = 100 %', sum, 100);
});

console.log(fails === 0 ? '\nAlle Tests bestanden ✓' : '\n' + fails + ' Test(s) fehlgeschlagen ✗');
process.exit(fails === 0 ? 0 : 1);
