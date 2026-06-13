'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const care = require('../src/care');

test('valid5er: nur positive 5er-Vielfache', () => {
  assert.ok(care.valid5er(5) && care.valid5er(30));
  assert.ok(!care.valid5er(7) && !care.valid5er(0) && !care.valid5er(-5) && !care.valid5er(2.5));
});

test('careRows: eine Zeile je Sprachversion, nur Änderungen zählen', () => {
  const projekt = { care_stufe: 'care-m', sprachversionen: 2 }; // care-m = 30 Min
  const mk = care.monthKey();
  const b = [
    { sprachversion: 1, minuten: 20, datum: mk + '-05', typ: 'aenderung' },
    { sprachversion: 2, minuten: 10, datum: mk + '-06', typ: 'aenderung' },
    { sprachversion: 1, minuten: 15, datum: mk + '-07', typ: 'stoerung' }, // zählt NICHT
  ];
  const rows = care.careRows(projekt, b, mk);
  assert.strictEqual(rows.length, 2);
  assert.deepStrictEqual(rows[0], { sprachversion: 1, verbraucht: 20, max: 30, verbleibend: 10 });
  assert.deepStrictEqual(rows[1], { sprachversion: 2, verbraucht: 10, max: 30, verbleibend: 20 });
});

test('estimateEuro: 150 €/Std anteilig', () => {
  assert.strictEqual(care.estimateEuro(60), 150);
  assert.strictEqual(care.estimateEuro(30), 75);
});
