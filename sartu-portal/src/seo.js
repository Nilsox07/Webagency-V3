'use strict';
function monthKey(d) { const x = d ? new Date(d) : new Date(); return x.toISOString().slice(0, 7); }
// Letzter Tag des Monats (Verfallsdatum der Kontingente).
function monthEnd(mk) {
  const [y, m] = (mk || monthKey()).split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return mk + '-' + String(last).padStart(2, '0');
}
// Abo gilt als aktiv, wenn kein Kündigungsdatum in der Vergangenheit liegt.
function aboAktiv(abo, today) {
  if (!abo) return false;
  if (!abo.kuendigung_zum) return true;
  return new Date(abo.kuendigung_zum) >= new Date(today || Date.now());
}
module.exports = { monthKey, monthEnd, aboAktiv };
