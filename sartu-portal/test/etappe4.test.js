'use strict';
// Etappe 4: 5er-Takt-Validierung, Kostenschätzungs-Freigabe-Pflicht vor Buchung, Care-Tab je Sprachversion.
const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const H = require('./helpers');

let app, kunde, kundeCookie, adminCookie, projekt;
before(async () => { app = await H.makeApp(); });
beforeEach(async () => {
  await H.db.query('DELETE FROM care_buchungen'); await H.db.query('DELETE FROM kostenschaetzungen');
  await H.db.query('DELETE FROM tickets'); await H.db.query('DELETE FROM audit_log');
  await H.db.query('DELETE FROM projekte'); await H.db.query('DELETE FROM kunden'); await H.db.query('DELETE FROM admin_user');
  kunde = await H.createKunde('e4@kunde.de', 'Mia', 'E4 GmbH');
  kundeCookie = await H.loginKunde(app, kunde.id);
  adminCookie = await H.loginAdmin(app);
  projekt = await H.db.one(`INSERT INTO projekte (kunde_id,name,care_stufe,sprachversionen) VALUES ($1,'P','care-m',2) RETURNING *`, [kunde.id]);
});

test('Care-Buchung: Minuten NUR in 5er-Schritten (7 → 400, 10 → ok)', async () => {
  const base = '/admin/projekt/' + projekt.id;
  const bad = await H.postCsrf(app, base, '/admin/projekt/' + projekt.id + '/buchung', { minuten: '7', beschreibung: 'x' }, adminCookie);
  assert.strictEqual(bad.statusCode, 400);
  const ok = await H.postCsrf(app, base, '/admin/projekt/' + projekt.id + '/buchung', { minuten: '10', beschreibung: 'x' }, adminCookie);
  assert.strictEqual(ok.statusCode, 302);
  const b = await H.db.one(`SELECT minuten FROM care_buchungen WHERE projekt_id=$1`, [projekt.id]);
  assert.strictEqual(b.minuten, 10);
});

test('Kostenschätzung: erst Freigabe durch Kunde, dann buchbar', async () => {
  const s = await H.db.one(`INSERT INTO kostenschaetzungen (projekt_id,beschreibung,minuten_geschaetzt,betrag,status) VALUES ($1,'Extra',60,150,'offen') RETURNING *`, [projekt.id]);
  const abase = '/admin/projekt/' + projekt.id;
  // Buchung mit offener Schätzung -> 409
  const blocked = await H.postCsrf(app, abase, abase + '/buchung', { minuten: '60', schaetzung_id: s.id, beschreibung: 'Extra' }, adminCookie);
  assert.strictEqual(blocked.statusCode, 409);
  // Kunde gibt frei (+ audit_log)
  const kbase = '/portal/projekt/' + projekt.id + '/care';
  const fr = await H.postCsrf(app, kbase, '/portal/projekt/' + projekt.id + '/schaetzung/' + s.id + '/freigeben', {}, kundeCookie);
  assert.strictEqual(fr.statusCode, 302);
  const sd = await H.db.one(`SELECT status FROM kostenschaetzungen WHERE id=$1`, [s.id]);
  assert.strictEqual(sd.status, 'freigegeben');
  assert.ok(await H.db.one(`SELECT id FROM audit_log WHERE aktion='schaetzung_freigegeben'`));
  // Jetzt buchbar
  const ok = await H.postCsrf(app, abase, abase + '/buchung', { minuten: '60', schaetzung_id: s.id, beschreibung: 'Extra' }, adminCookie);
  assert.strictEqual(ok.statusCode, 302);
});

test('Care-Tab zeigt eine Zeile je Sprachversion', async () => {
  const res = await app.inject({ method: 'GET', url: '/portal/projekt/' + projekt.id + '/care', headers: { cookie: kundeCookie } });
  assert.strictEqual(res.statusCode, 200);
  assert.match(res.body, /Sprachversion 1/);
  assert.match(res.body, /Sprachversion 2/);
});

test('Störung melden legt Ticket an', async () => {
  const base = '/portal/projekt/' + projekt.id;
  await H.postCsrf(app, base + '/care', base + '/ticket', { typ: 'stoerung', text: 'Seite lädt nicht' }, kundeCookie);
  const t = await H.db.one(`SELECT typ, text FROM tickets WHERE projekt_id=$1`, [projekt.id]);
  assert.strictEqual(t.typ, 'stoerung');
  assert.match(t.text, /lädt nicht/);
});
