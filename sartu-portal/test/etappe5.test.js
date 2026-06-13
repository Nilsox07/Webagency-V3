'use strict';
// Etappe 5: SEO-Tab (Kontingent + Verfall + Dokumente), Kündigungs-Anfrage, Extra-Anfrage.
const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const H = require('./helpers');
const seo = require('../src/seo');

let app, kunde, cookie, projekt;
before(async () => { app = await H.makeApp(); });
beforeEach(async () => {
  await H.db.query('DELETE FROM seo_dokumente'); await H.db.query('DELETE FROM seo_kontingente'); await H.db.query('DELETE FROM seo_abos');
  await H.db.query('DELETE FROM tickets'); await H.db.query('DELETE FROM projekte'); await H.db.query('DELETE FROM kunden');
  kunde = await H.createKunde('e5@kunde.de', 'Nora', 'E5 GmbH'); cookie = await H.loginKunde(app, kunde.id);
  projekt = await H.db.one(`INSERT INTO projekte (kunde_id,name) VALUES ($1,'P') RETURNING *`, [kunde.id]);
});

test('SEO-Tab zeigt Kontingent (x/y), Verfallsdatum und Dokumente', async () => {
  await H.db.query(`INSERT INTO seo_abos (projekt_id,stufe) VALUES ($1,'seo-lite')`, [projekt.id]);
  const mk = seo.monthKey();
  await H.db.query(`INSERT INTO seo_kontingente (projekt_id,monat,refresh_max,refresh_verbraucht,seiten_max,seiten_verbraucht,tracking_max) VALUES ($1,$2,1,1,1,0,20)`, [projekt.id, mk]);
  await H.db.query(`INSERT INTO seo_dokumente (projekt_id,typ,monat,pdf_pfad) VALUES ($1,'report',$2,'/x.pdf')`, [projekt.id, mk]);
  const res = await app.inject({ method: 'GET', url: '/portal/projekt/' + projekt.id + '/seo', headers: { cookie } });
  assert.strictEqual(res.statusCode, 200);
  assert.match(res.body, /1\/1/);                  // Refreshes verbraucht/max
  assert.match(res.body, new RegExp(seo.monthEnd(mk))); // Verfallsdatum
  assert.match(res.body, /report/);                // Dokument
});

test('Ohne aktives Abo: SEO-Tab verweist auf Extras (kein Kontingent)', async () => {
  const res = await app.inject({ method: 'GET', url: '/portal/projekt/' + projekt.id + '/seo', headers: { cookie } });
  assert.match(res.body, /keine aktive SEO-Betreuung/i);
});

test('SEO-Kündigung legt Anfrage-Ticket an (keine sofortige Kündigung)', async () => {
  await H.db.query(`INSERT INTO seo_abos (projekt_id,stufe) VALUES ($1,'seo-pro')`, [projekt.id]);
  const base = '/portal/projekt/' + projekt.id;
  await H.postCsrf(app, base + '/seo', base + '/seo/kuendigung', {}, cookie);
  const t = await H.db.one(`SELECT typ FROM tickets WHERE projekt_id=$1`, [projekt.id]);
  assert.strictEqual(t.typ, 'seo_kuendigung');
});

test('Extra nachbuchen erzeugt Anfrage-Ticket (keine Zahlung)', async () => {
  const base = '/portal/projekt/' + projekt.id;
  await H.postCsrf(app, base + '/extras', base + '/extras/anfrage', { key: 'logo-lite' }, cookie);
  const t = await H.db.one(`SELECT typ, text FROM tickets WHERE projekt_id=$1`, [projekt.id]);
  assert.strictEqual(t.typ, 'extra_anfrage');
  assert.match(t.text, /Logo Lite/);
});
