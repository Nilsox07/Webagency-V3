'use strict';
// Reine Care-Logik: 5-Minuten-Takt, Monatskontingent je Sprachversion, €-Schätzung.
const prices = require('./prices');

// Minuten nur in 5er-Schritten, größer 0.
function valid5er(min) { const n = Number(min); return Number.isInteger(n) && n > 0 && n % 5 === 0; }

function monthKey(d) { const x = d ? new Date(d) : new Date(); return x.toISOString().slice(0, 7); }

// Eine Zeile je Sprachversion: verbraucht/verbleibend der Inklusiv-Minuten des Monats.
// Nur Typ 'aenderung' zählt gegen das Kontingent (Störungen laufen über die Reaktionsklausel).
function careRows(projekt, buchungen, mk) {
  mk = mk || monthKey();
  const max = (prices.care[projekt.care_stufe] || {}).minuten || 0;
  const N = Math.max(1, projekt.sprachversionen || 1);
  const rows = [];
  for (let s = 1; s <= N; s++) {
    const verbraucht = (buchungen || [])
      .filter((b) => Number(b.sprachversion) === s && monthKey(b.datum) === mk && b.typ === 'aenderung')
      .reduce((a, b) => a + (Number(b.minuten) || 0), 0);
    rows.push({ sprachversion: s, verbraucht, max, verbleibend: Math.max(0, max - verbraucht) });
  }
  return rows;
}

module.exports = { valid5er, monthKey, careRows, estimateEuro: (m) => prices.estimateEuro(m) };
