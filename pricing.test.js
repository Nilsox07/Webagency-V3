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

// 1) Basis + Care S (49 €/Mon, Pflicht), keine Add-ons
var r1 = t({ paket: 'basis', wartung: 'care-s', addons: addons({}) });
eq('Basis einmalig', r1.once, 1290);
eq('Basis monatlich (Care S 49)', r1.monthly, 49);

// 2) Pro + Care M (99) + Logo Lite (490) + Texte ×3 (120×3)
var r2 = t({ paket: 'pro', wartung: 'care-m', addons: addons({ 'logo-lite': true, texte: 3 }) });
eq('Pro+Logo Lite+Texte×3 einmalig', r2.once, 2990 + 490 + 360);
eq('Pro+Care M monatlich', r2.monthly, 99);

// 3) Platin + Care L (249) + Chatbot-Betrieb (49/Mon) + Terminbuchung (290 einmalig)
var r3 = t({ paket: 'platin', wartung: 'care-l', addons: addons({ 'chatbot-betrieb': true, terminbuchung: true }) });
eq('Platin einmalig (Termin)', r3.once, 5990 + 290);
eq('Platin monatlich (Care L 249 + Chatbot 49)', r3.monthly, 249 + 49);

// 4) Enterprise = price null → Paket zählt NICHT in die Einmalsumme
var r4 = t({ paket: 'enterprise', wartung: 'care-l', addons: addons({ analytics: true }) });
eq('Enterprise einmalig (Paket null, nur Analytics 190)', r4.once, 190);
eq('Enterprise monatlich (Care L 249)', r4.monthly, 249);

// 5) Mengen-Clamp: Texte ×20 → max 10
var r5 = t({ paket: 'basis', wartung: 'care-s', addons: addons({ texte: 20 }) });
eq('Texte ×20 → geclamped auf 10 (120×10)', r5.once, 1290 + 1200);

// 6) Abgewähltes Add-on zählt nicht
var st6 = addons({ 'logo-lite': true }); st6['logo-lite'].selected = false;
var r6 = t({ paket: 'basis', wartung: 'care-s', addons: st6 });
eq('Abgewähltes Add-on zählt nicht', r6.once, 1290);

// 7) Express = +50 % vom Paketpreis, mind. 390 € (Pro 2990 → +1495)
var r7 = t({ paket: 'pro', wartung: 'care-m', addons: addons({ express: true }) });
eq('Express +50 % auf Pro (2990→+1495)', r7.once, 2990 + 1495);

// 8) Mehrsprachigkeit = +40 % je Sprache (Basis 1290, ×2 → +1032)
var r8 = t({ paket: 'basis', wartung: 'care-s', addons: addons({ mehrsprachig: 2 }) });
eq('Mehrsprachig ×2 (+40 % je Sprache) einmalig', r8.once, 1290 + 1032);

// 9) Extraseiten (Variante A): Pro + 5 Extraseiten (199×5)
var r9 = t({ paket: 'pro', wartung: 'care-m', extraPages: 5, addons: addons({}) });
eq('Pro + 5 Extraseiten einmalig (2990 + 995)', r9.once, 2990 + 995);
eq('Pro + 5 Extraseiten monatlich (Care M 99)', r9.monthly, 99);

// 10) Monatliche Retainer: SEO Lite (149) + Profil Basic (79) + Care M (99)
var r10 = t({ paket: 'pro', wartung: 'care-m', addons: addons({ 'seo-lite': true, 'profil-basic': true }) });
eq('SEO Lite + Profil Basic + Care M monatlich', r10.monthly, 99 + 149 + 79);

// 7) Zahlungsstaffelung: Prozente ergeben 100 %
['basis', 'pro', 'platin', 'enterprise'].forEach(function (id) {
  var sum = PAY.forPackage(id).reduce(function (s, x) { return s + x.pct; }, 0);
  eq('Staffelung ' + id + ' = 100 %', sum, 100);
});

console.log(fails === 0 ? '\nAlle Tests bestanden ✓' : '\n' + fails + ' Test(s) fehlgeschlagen ✗');
process.exit(fails === 0 ? 0 : 1);
