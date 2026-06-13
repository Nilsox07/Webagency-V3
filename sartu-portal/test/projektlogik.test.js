'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const L = require('../src/projektlogik');

test('Timeline markiert genau die aktuelle Phase, davor done, danach todo', () => {
  const tl = L.timeline('design');
  const states = tl.map((p) => p.state).join(',');
  assert.strictEqual(states, 'done,done,done,current,todo,todo,todo,todo');
  assert.strictEqual(L.timeline('korrektur_2').find((p) => p.key === 'korrektur').state, 'current');
});

test('Countdown startet ERST bei Vollständigkeit der Inhalte', () => {
  const liefertermin = '2026-07-01';
  assert.strictEqual(L.countdownDays({ liefertermin, inhalte_vollstaendig_am: null }), null);
  const d = L.countdownDays({ liefertermin, inhalte_vollstaendig_am: '2026-06-10' }, '2026-06-01');
  assert.strictEqual(d, 30);
});

test('inhalteReady: alle Seiten brauchen >= 5 Stichpunkt-Zeilen', () => {
  const voll = { stichpunkte: 'a\nb\nc\nd\ne' };
  const wenig = { stichpunkte: 'a\nb\nc' };
  assert.strictEqual(L.seiteReady(voll), true);
  assert.strictEqual(L.seiteReady(wenig), false);
  assert.strictEqual(L.inhalteReady({ is_redesign: false }, [voll, voll]), true);
  assert.strictEqual(L.inhalteReady({ is_redesign: false }, [voll, wenig]), false);
  assert.strictEqual(L.inhalteReady({ is_redesign: false }, []), false);
});

test('inhalteReady (Redesign): Alt-URL + Zugänge statt Stichpunkte', () => {
  assert.strictEqual(L.inhalteReady({ is_redesign: true, alt_url: '' }, [], { zugaengeVorhanden: true }), false);
  assert.strictEqual(L.inhalteReady({ is_redesign: true, alt_url: 'https://alt.de' }, [], { zugaengeVorhanden: false }), false);
  assert.strictEqual(L.inhalteReady({ is_redesign: true, alt_url: 'https://alt.de' }, [], { zugaengeVorhanden: true }), true);
});

test('Blocker-Box leitet offene Aufgaben ab', () => {
  const p = { id: 'p1', status: 'inhalte', is_redesign: false };
  const b = L.blockers(p, { offeneSeiten: [{ seitenname: 'Kontakt' }], offeneSchaetzungen: [{ beschreibung: 'Extra X' }], offeneRunde: true });
  const txt = b.map((x) => x.text).join(' | ');
  assert.match(txt, /Kontakt/);
  assert.match(txt, /Kostenschätzung freigeben: Extra X/);
  assert.match(txt, /Korrekturrunde einreichen/);
  // Angebot-Phase blockt auf Zusage
  assert.match(L.blockers({ id: 'p2', status: 'angebot' }, {})[0].text, /Angebot/);
});
